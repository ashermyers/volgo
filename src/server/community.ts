import { auth, clerkClient } from "@clerk/tanstack-react-start/server";
import { createServerFn } from "@tanstack/react-start";
import type { Db, Document, WithId } from "mongodb";

import {
	type ActiveConnection,
	auditLookupInputSchema,
	type BoardItem,
	boardPaginationInputSchema,
	type CommunityPost,
	discoverFeedInputSchema,
	expressInterestInputSchema,
	type IncomingInterest,
	type LeaderboardEntry,
	matchActionInputSchema,
	type SolanaAudit,
	sendThankYouInputSchema,
} from "#/features/community/schema";
import {
	paginationInputSchema,
	paginationMeta,
} from "#/features/pagination/schema";
import { connectToDatabase, parseObjectId } from "#/lib/db";
import { confirmExchange } from "#/lib/exchanges";
import { archiveOwnedIntent } from "#/lib/intent-archive";
import type { IntentKind } from "#/lib/matching";
import { scoreOpportunity } from "#/lib/matching";
import { createNotification, wantsInterestAlerts } from "#/lib/notifications";
import {
	ensureSolanaAudit,
	getSolanaAuditPublicConfig,
} from "#/lib/solana-audit";
import { sanitizeThankYouMessage } from "#/lib/thank-you";

type UserContext = {
	offerSkills: string[];
	requestSkills: string[];
	minutes: number | null;
};

function asStringArray(value: unknown) {
	return Array.isArray(value)
		? value.filter((item): item is string => typeof item === "string")
		: [];
}

function asNullableNumber(value: unknown) {
	return typeof value === "number" ? value : null;
}

function asNullableString(value: unknown) {
	return typeof value === "string" ? value : null;
}

function thankYouFields(match: Document) {
	const thankYou =
		match.thankYou && typeof match.thankYou === "object"
			? (match.thankYou as Record<string, unknown>)
			: null;
	const message =
		typeof thankYou?.message === "string" ? thankYou.message.trim() : "";
	return {
		thankYouSent: message.length > 0,
		thankYouMessage: message.length > 0 ? message : null,
	};
}

function toIsoDate(value: unknown) {
	if (value instanceof Date) return value.toISOString();
	return new Date(String(value)).toISOString();
}

function incomingMatchStatus(status: unknown) {
	if (
		status === "accepted" ||
		status === "awaiting_confirmation" ||
		status === "completed" ||
		status === "withdrawn"
	) {
		return status;
	}
	return "pending" as const;
}

function uniqueSkills(skills: string[]) {
	const seen = new Set<string>();
	const result: string[] = [];

	for (const skill of skills) {
		const key = skill.trim().toLowerCase();
		if (!key || seen.has(key)) continue;
		seen.add(key);
		result.push(skill);
	}

	return result;
}

function mapSolanaAudit(value: unknown): SolanaAudit | null {
	if (!value || typeof value !== "object") return null;
	const audit = value as Record<string, unknown>;
	const status =
		audit.status === "pending" ||
		audit.status === "submitting" ||
		audit.status === "submitted" ||
		audit.status === "confirmed" ||
		audit.status === "failed" ||
		audit.status === "unconfigured"
			? audit.status
			: null;
	if (!status) return null;

	return {
		status,
		network: typeof audit.network === "string" ? audit.network : "devnet",
		receiptId: typeof audit.receiptId === "string" ? audit.receiptId : "",
		receiptHash: typeof audit.receiptHash === "string" ? audit.receiptHash : "",
		authority: typeof audit.authority === "string" ? audit.authority : null,
		signature: typeof audit.signature === "string" ? audit.signature : null,
		slot: typeof audit.slot === "number" ? audit.slot : null,
		explorerUrl:
			typeof audit.explorerUrl === "string" ? audit.explorerUrl : null,
	};
}

function mapDocument(
	document: WithId<Document>,
	type: IntentKind,
	displayName: string,
): Omit<
	CommunityPost,
	"matchScore" | "matchExplanation" | "expressedInterest"
> {
	const skills =
		type === "offer"
			? asStringArray(document.skills)
			: asStringArray(document.skillsNeeded);

	return {
		id: document._id.toString(),
		type,
		title: String(document.title),
		description: String(document.description),
		skills,
		minutes:
			type === "offer"
				? asNullableNumber(document.availableMinutes)
				: asNullableNumber(document.estimatedMinutes),
		availability: asNullableString(document.availability),
		status:
			document.status === "matched" ||
			document.status === "completed" ||
			document.status === "active" ||
			document.status === "open" ||
			document.status === "archived"
				? document.status
				: type === "offer"
					? "active"
					: "open",
		createdAt: toIsoDate(document.createdAt),
		userId: String(document.userId),
		displayName:
			typeof document.displayName === "string" && document.displayName.trim()
				? document.displayName
				: displayName,
	};
}

async function namesFor(userIds: string[]) {
	const uniqueIds = [...new Set(userIds)].filter(Boolean);
	const names = new Map<string, string>();

	if (uniqueIds.length === 0) return names;

	try {
		const response = await clerkClient().users.getUserList({
			userId: uniqueIds,
			limit: 100,
		});

		for (const user of response.data) {
			names.set(user.id, user.firstName || user.username || "Community member");
		}
	} catch {
		for (const userId of uniqueIds) {
			names.set(userId, "Community member");
		}
	}

	return names;
}

function buildUserContext(
	offers: WithId<Document>[],
	requests: WithId<Document>[],
): UserContext {
	const offerSkills = uniqueSkills(
		offers.flatMap((offer) => asStringArray(offer.skills)),
	);
	const requestSkills = uniqueSkills(
		requests.flatMap((request) => asStringArray(request.skillsNeeded)),
	);
	const minutes = [...offers, ...requests]
		.map(
			(item) =>
				asNullableNumber(item.availableMinutes) ??
				asNullableNumber(item.estimatedMinutes),
		)
		.find((value): value is number => value !== null);

	return { offerSkills, requestSkills, minutes: minutes ?? null };
}

function forYouRankingStages(userContext: UserContext): Document[] {
	const normalize = (skills: string[]) => [
		...new Set(
			skills.map((skill) => skill.trim().toLowerCase()).filter(Boolean),
		),
	];
	const offerSkills = normalize(userContext.offerSkills);
	const requestSkills = normalize(userContext.requestSkills);
	const allSkills = normalize([...offerSkills, ...requestSkills]);

	return [
		{
			$set: {
				__primarySkills: {
					$switch: {
						branches: [
							{
								case: {
									$and: [
										{ $eq: ["$__postType", "request"] },
										{ $gt: [offerSkills.length, 0] },
									],
								},
								// biome-ignore lint/suspicious/noThenProperty: MongoDB $switch branches require then.
								then: offerSkills,
							},
							{
								case: {
									$and: [
										{ $eq: ["$__postType", "offer"] },
										{ $gt: [requestSkills.length, 0] },
									],
								},
								// biome-ignore lint/suspicious/noThenProperty: MongoDB $switch branches require then.
								then: requestSkills,
							},
						],
						default: allSkills,
					},
				},
				__complementary: {
					$or: [
						{
							$and: [
								{ $eq: ["$__postType", "request"] },
								{ $gt: [offerSkills.length, 0] },
							],
						},
						{
							$and: [
								{ $eq: ["$__postType", "offer"] },
								{ $gt: [requestSkills.length, 0] },
							],
						},
					],
				},
				__postSkills: {
					$map: {
						input: { $cond: [{ $isArray: "$skills" }, "$skills", []] },
						as: "skill",
						in: {
							$toLower: {
								$trim: { input: { $toString: "$$skill" } },
							},
						},
					},
				},
				__postMinutes: {
					$ifNull: ["$availableMinutes", "$estimatedMinutes"],
				},
			},
		},
		{
			$set: {
				__sharedSkills: {
					$setIntersection: ["$__primarySkills", "$__postSkills"],
				},
			},
		},
		{
			$set: {
				__matchScore: {
					$cond: [
						{
							$and: [
								{ $eq: [{ $size: "$__primarySkills" }, 0] },
								{ $eq: [{ $size: "$__postSkills" }, 0] },
							],
						},
						{ $cond: ["$__complementary", 28, 14] },
						{
							$min: [
								99,
								{
									$max: [
										8,
										{
											$add: [
												{
													$round: [
														{
															$multiply: [
																{
																	$divide: [
																		{ $size: "$__sharedSkills" },
																		{
																			$max: [
																				{ $size: "$__primarySkills" },
																				{ $size: "$__postSkills" },
																				1,
																			],
																		},
																	],
																},
																72,
															],
														},
														0,
													],
												},
												{ $cond: ["$__complementary", 16, 0] },
												{
													$cond: [
														{
															$and: [
																{ $gt: ["$__postMinutes", 0] },
																{ $gt: [userContext.minutes ?? 0, 0] },
															],
														},
														{
															$round: [
																{
																	$multiply: [
																		{
																			$subtract: [
																				1,
																				{
																					$min: [
																						1,
																						{
																							$divide: [
																								{
																									$abs: {
																										$subtract: [
																											"$__postMinutes",
																											userContext.minutes ?? 0,
																										],
																									},
																								},
																								180,
																							],
																						},
																					],
																				},
																			],
																		},
																		12,
																	],
																},
																0,
															],
														},
														0,
													],
												},
											],
										},
									],
								},
							],
						},
					],
				},
			},
		},
		{ $sort: { __matchScore: -1, createdAt: -1, _id: -1 } },
	];
}

function impactPostPipeline(userId: string): Document[] {
	return [
		{ $match: { userId, status: { $ne: "archived" } } },
		{
			$set: {
				__postType: "offer",
				__minutes: { $ifNull: ["$availableMinutes", 0] },
				__skills: { $cond: [{ $isArray: "$skills" }, "$skills", []] },
			},
		},
		{
			$unionWith: {
				coll: "helpRequests",
				pipeline: [
					{ $match: { userId, status: { $ne: "archived" } } },
					{
						$set: {
							__postType: "request",
							__minutes: { $ifNull: ["$estimatedMinutes", 0] },
							__skills: {
								$cond: [{ $isArray: "$skillsNeeded" }, "$skillsNeeded", []],
							},
						},
					},
				],
			},
		},
	];
}

export async function readCommunityStats(database: Db) {
	const [activeOffers, activeRequests, members, exchangeTotals] =
		await Promise.all([
			database.collection("offers").countDocuments({
				status: { $in: ["active", "matched"] },
				archivedAt: { $exists: false },
			}),
			database.collection("helpRequests").countDocuments({
				status: { $in: ["open", "active", "matched"] },
				archivedAt: { $exists: false },
			}),
			database
				.collection("profiles")
				.countDocuments({ onboardingCompleted: true }),
			database
				.collection("exchanges")
				.aggregate<{ completedExchanges: number; verifiedMinutes: number }>([
					{ $match: { status: "completed", verifiedByBoth: true } },
					{
						$group: {
							_id: null,
							completedExchanges: { $sum: 1 },
							verifiedMinutes: { $sum: "$minutes" },
						},
					},
				])
				.toArray(),
		]);

	return {
		activePosts: activeOffers + activeRequests,
		members,
		completedExchanges: exchangeTotals[0]?.completedExchanges ?? 0,
		verifiedMinutes: exchangeTotals[0]?.verifiedMinutes ?? 0,
	};
}

export const getCommunityStatsFn = createServerFn({ method: "GET" }).handler(
	async () => readCommunityStats(await connectToDatabase()),
);

export const getDiscoverFeedFn = createServerFn({ method: "GET" })
	.validator(discoverFeedInputSchema)
	.handler(async ({ data }) => {
		const { isAuthenticated, userId } = await auth();
		const database = await connectToDatabase();
		const offerFilter = {
			status: { $in: ["active", "matched"] },
			archivedAt: { $exists: false },
			...(userId ? { userId: { $ne: userId } } : {}),
		};
		const requestFilter = {
			status: { $in: ["open", "matched", "active"] },
			archivedAt: { $exists: false },
			...(userId ? { userId: { $ne: userId } } : {}),
		};
		let userContext: UserContext = {
			offerSkills: [],
			requestSkills: [],
			minutes: null,
		};

		if (userId) {
			const [myOffers, myRequests] = await Promise.all([
				database
					.collection("offers")
					.find({ userId, status: { $in: ["active", "matched"] } })
					.toArray(),
				database
					.collection("helpRequests")
					.find({ userId, status: { $in: ["open", "matched", "active"] } })
					.toArray(),
			]);
			userContext = buildUserContext(myOffers, myRequests);
		}
		const hasProfileSignal =
			userContext.offerSkills.length > 0 ||
			userContext.requestSkills.length > 0;

		const [offerCount, requestCount] = await Promise.all([
			data.filter === "request"
				? Promise.resolve(0)
				: database.collection("offers").countDocuments(offerFilter),
			data.filter === "offer"
				? Promise.resolve(0)
				: database.collection("helpRequests").countDocuments(requestFilter),
		]);
		const pageInfo = paginationMeta({
			page: data.page,
			pageSize: data.pageSize,
			totalItems: offerCount + requestCount,
		});
		const offset = (pageInfo.page - 1) * pageInfo.pageSize;
		let documents: WithId<Document>[];

		if (data.filter === "offer") {
			const offers = await database
				.collection("offers")
				.find(offerFilter)
				.sort({ createdAt: -1, _id: -1 })
				.skip(offset)
				.limit(pageInfo.pageSize)
				.toArray();
			documents = offers.map((offer) => ({
				...offer,
				__postType: "offer",
			}));
		} else if (data.filter === "request") {
			const requests = await database
				.collection("helpRequests")
				.find(requestFilter)
				.sort({ createdAt: -1, _id: -1 })
				.skip(offset)
				.limit(pageInfo.pageSize)
				.toArray();
			documents = requests.map((request) => ({
				...request,
				__postType: "request",
			}));
		} else {
			const rankingStages =
				data.filter === "for-you" && hasProfileSignal
					? forYouRankingStages(userContext)
					: [];
			documents = await database
				.collection("offers")
				.aggregate<WithId<Document>>([
					{ $match: offerFilter },
					{ $addFields: { __postType: "offer" } },
					{
						$unionWith: {
							coll: "helpRequests",
							pipeline: [
								{ $match: requestFilter },
								{ $addFields: { __postType: "request" } },
							],
						},
					},
					...rankingStages,
					...(data.filter === "for-you" && hasProfileSignal
						? []
						: [{ $sort: { createdAt: -1, _id: -1 } }]),
					{ $skip: offset },
					{ $limit: pageInfo.pageSize },
				])
				.toArray();
		}

		const postIds = documents.map((document) => document._id.toString());
		const [names, interests] = await Promise.all([
			namesFor(documents.map((document) => String(document.userId))),
			userId && postIds.length > 0
				? database
						.collection("matches")
						.find({
							fromUserId: userId,
							postId: { $in: postIds },
							status: {
								$in: [
									"pending",
									"accepted",
									"awaiting_confirmation",
									"completed",
								],
							},
						})
						.project({ postId: 1 })
						.toArray()
				: Promise.resolve([]),
		]);
		const interestedIds = new Set(
			interests.map((interest) => String(interest.postId)),
		);
		const items: CommunityPost[] = documents.map((document) => {
			const postType: IntentKind =
				document.__postType === "offer" ? "offer" : "request";
			const base = mapDocument(
				document,
				postType,
				names.get(String(document.userId)) ?? "Community member",
			);
			const match = userId
				? scoreOpportunity({
						postType,
						postSkills: base.skills,
						postMinutes: base.minutes,
						userOfferSkills: userContext.offerSkills,
						userRequestSkills: userContext.requestSkills,
						userMinutes: userContext.minutes,
					})
				: null;

			return {
				...base,
				matchScore: match?.score ?? null,
				matchExplanation: match?.explanation ?? null,
				expressedInterest: interestedIds.has(base.id),
			};
		});

		items.sort((left, right) => {
			if (data.filter === "for-you") {
				const scoreDelta = (right.matchScore ?? 0) - (left.matchScore ?? 0);
				if (scoreDelta !== 0) return scoreDelta;
			}
			const dateDelta = right.createdAt.localeCompare(left.createdAt);
			return dateDelta !== 0 ? dateDelta : right.id.localeCompare(left.id);
		});

		return {
			isAuthenticated,
			items,
			hasProfileSignal,
			pagination: pageInfo,
		};
	});

export const expressInterestFn = createServerFn({ method: "POST" })
	.validator(expressInterestInputSchema)
	.handler(async ({ data }) => {
		const { isAuthenticated, userId } = await auth();

		if (!isAuthenticated || !userId) {
			throw new Error("You must be signed in to continue");
		}

		const postId = await parseObjectId(data.postId);
		if (!postId) {
			throw new Error("That post could not be found");
		}

		const database = await connectToDatabase();
		const collectionName =
			data.postType === "offer" ? "offers" : "helpRequests";
		const post = await database.collection(collectionName).findOne({
			_id: postId,
			status:
				data.postType === "offer"
					? { $in: ["active", "matched"] }
					: { $in: ["open", "active", "matched"] },
			archivedAt: { $exists: false },
		});

		if (!post) {
			throw new Error("That post could not be found");
		}

		if (String(post.userId) === userId) {
			throw new Error("You cannot respond to your own post");
		}

		const existing = await database.collection("matches").findOne({
			fromUserId: userId,
			postId: data.postId,
		});

		if (existing && existing.status !== "withdrawn") {
			return { id: existing._id.toString(), alreadySent: true };
		}

		const mapped = mapDocument(post, data.postType, "Community member");
		const [myOffers, myRequests] = await Promise.all([
			database
				.collection("offers")
				.find({ userId, status: { $in: ["active", "matched"] } })
				.toArray(),
			database
				.collection("helpRequests")
				.find({ userId, status: { $in: ["open", "active", "matched"] } })
				.toArray(),
		]);
		const userContext = buildUserContext(myOffers, myRequests);
		const match = scoreOpportunity({
			postType: data.postType,
			postSkills: mapped.skills,
			postMinutes: mapped.minutes,
			userOfferSkills: userContext.offerSkills,
			userRequestSkills: userContext.requestSkills,
			userMinutes: userContext.minutes,
		});

		const now = new Date();
		const matchId = existing
			? existing._id
			: (
					await database.collection("matches").insertOne({
						postId: data.postId,
						postType: data.postType,
						fromUserId: userId,
						toUserId: String(post.userId),
						score: match.score,
						explanation: match.explanation,
						status: "pending",
						createdAt: now,
					})
				).insertedId;
		if (existing) {
			await database.collection("matches").updateOne(
				{ _id: existing._id, status: "withdrawn" },
				{
					$set: {
						status: "pending",
						score: match.score,
						explanation: match.explanation,
						updatedAt: now,
					},
					$unset: { withdrawnAt: "" },
				},
			);
		}

		const names = await namesFor([userId]);
		const ownerProfile = await database.collection("profiles").findOne({
			clerkUserId: String(post.userId),
		});
		if (
			wantsInterestAlerts({
				notifyOnInterest: ownerProfile?.notifyOnInterest,
			})
		) {
			await createNotification(database, {
				userId: String(post.userId),
				actorUserId: userId,
				type: "interest_received",
				title:
					data.postType === "request"
						? "Someone offered to help"
						: "Someone is interested",
				body: `${names.get(userId) ?? "Someone"} responded to “${mapped.title}”.`,
				href: "/requests",
				entityId: `interest:${matchId.toString()}:${now.getTime()}`,
			});
		}

		return { id: matchId.toString(), alreadySent: false };
	});

export const withdrawInterestFn = createServerFn({ method: "POST" })
	.validator(expressInterestInputSchema)
	.handler(async ({ data }) => {
		const { isAuthenticated, userId } = await auth();
		if (!isAuthenticated || !userId) {
			throw new Error("You must be signed in to continue");
		}

		const database = await connectToDatabase();
		const match = await database.collection("matches").findOne({
			fromUserId: userId,
			postId: data.postId,
			status: "pending",
		});
		if (!match) {
			throw new Error("That reply is no longer pending");
		}

		const now = new Date();
		await database.collection("matches").updateOne(
			{ _id: match._id, fromUserId: userId, status: "pending" },
			{
				$set: {
					status: "withdrawn",
					withdrawnAt: now,
					updatedAt: now,
				},
			},
		);

		const names = await namesFor([userId]);
		await createNotification(database, {
			userId: String(match.toUserId),
			actorUserId: userId,
			type: "interest_withdrawn",
			title: "Someone withdrew their reply",
			body: `${names.get(userId) ?? "Someone"} withdrew interest in your post.`,
			href: "/requests",
			entityId: `interest-withdrawn:${match._id.toString()}`,
		});

		return { ok: true as const, withdrawn: true as const };
	});

function collectionFor(postType: IntentKind) {
	return postType === "offer" ? "offers" : "helpRequests";
}

export const getMyBoardFn = createServerFn({ method: "GET" }).handler(
	async () => {
		const { isAuthenticated, userId } = await auth();

		if (!isAuthenticated || !userId) {
			return {
				isAuthenticated: false,
				items: [] as BoardItem[],
				incoming: [] as IncomingInterest[],
				connections: [] as ActiveConnection[],
			};
		}

		const database = await connectToDatabase();
		const [offers, requests, matches] = await Promise.all([
			database
				.collection("offers")
				.find({ userId })
				.sort({ createdAt: -1 })
				.limit(50)
				.toArray(),
			database
				.collection("helpRequests")
				.find({ userId })
				.sort({ createdAt: -1 })
				.limit(50)
				.toArray(),
			database
				.collection("matches")
				.find({
					$or: [{ toUserId: userId }, { fromUserId: userId }],
					status: { $ne: "archived" },
				})
				.sort({ createdAt: -1 })
				.toArray(),
		]);

		const posts = [
			...offers.map((offer) => mapDocument(offer, "offer", "You")),
			...requests.map((request) => mapDocument(request, "request", "You")),
		];
		const postsById = new Map(posts.map((post) => [post.id, post]));

		const incomingMatches = matches.filter(
			(match) => String(match.toUserId) === userId,
		);
		const names = await namesFor(
			incomingMatches.map((match) => String(match.fromUserId)),
		);

		const incoming: IncomingInterest[] = incomingMatches.flatMap((match) => {
			const post = postsById.get(String(match.postId));
			if (!post) return [];

			const status = incomingMatchStatus(match.status);

			return [
				{
					id: match._id.toString(),
					postId: post.id,
					postType: post.type,
					postTitle: post.title,
					fromDisplayName:
						names.get(String(match.fromUserId)) ?? "Community member",
					score: typeof match.score === "number" ? match.score : 0,
					explanation: asNullableString(match.explanation),
					status,
					createdAt: toIsoDate(match.createdAt),
				},
			];
		});

		const items: BoardItem[] = posts
			.sort((left, right) => right.createdAt.localeCompare(left.createdAt))
			.map((post) => {
				const related = incoming.filter((item) => item.postId === post.id);
				const accepted = related.find(
					(item) =>
						item.status === "accepted" ||
						item.status === "awaiting_confirmation",
				);
				const completed = related.find((item) => item.status === "completed");
				const partner = completed ?? accepted ?? null;

				return {
					id: post.id,
					type: post.type,
					title: post.title,
					description: post.description,
					skills: post.skills,
					minutes: post.minutes,
					availability: post.availability,
					status: post.status,
					createdAt: post.createdAt,
					incomingCount: related.filter((item) => item.status === "pending")
						.length,
					partnerName: partner?.fromDisplayName ?? null,
					acceptedMatchId: accepted?.id ?? completed?.id ?? null,
				};
			});

		const activeMatches = matches.filter(
			(match) =>
				match.status === "accepted" ||
				match.status === "awaiting_confirmation" ||
				match.status === "completed",
		);
		const partnerIds = activeMatches.map((match) =>
			String(match.fromUserId) === userId
				? String(match.toUserId)
				: String(match.fromUserId),
		);
		const [activeNames, partnerProfiles, connectionPosts, activeExchanges] =
			await Promise.all([
				namesFor(partnerIds),
				database
					.collection("profiles")
					.find({ clerkUserId: { $in: partnerIds } })
					.toArray(),
				Promise.all(
					activeMatches.map(async (match) => {
						const postId = await parseObjectId(String(match.postId));
						if (!postId) return null;
						const postType: IntentKind =
							match.postType === "offer" ? "offer" : "request";
						return database
							.collection(collectionFor(postType))
							.findOne({ _id: postId });
					}),
				),
				database
					.collection("exchanges")
					.find({
						matchId: {
							$in: activeMatches.map((match) => match._id.toString()),
						},
					})
					.toArray(),
			]);
		const profilesById = new Map(
			partnerProfiles.map((profile) => [String(profile.clerkUserId), profile]),
		);
		const exchangesByMatchId = new Map(
			activeExchanges.map((exchange) => [String(exchange.matchId), exchange]),
		);

		const connections: ActiveConnection[] = activeMatches.flatMap(
			(match, index) => {
				const post = connectionPosts[index];
				if (!post || post.status === "archived") return [];

				const fromUserId = String(match.fromUserId);
				const toUserId = String(match.toUserId);
				const partnerId = fromUserId === userId ? toUserId : fromUserId;
				const profile = profilesById.get(partnerId);
				const confirmedBy = asStringArray(match.confirmedBy);
				const bothVerified =
					confirmedBy.includes(fromUserId) && confirmedBy.includes(toUserId);
				const postType: IntentKind =
					match.postType === "offer" ? "offer" : "request";
				const providerUserId = postType === "request" ? fromUserId : toUserId;

				return [
					{
						id: match._id.toString(),
						postTitle: String(post.title),
						postType,
						partnerName: activeNames.get(partnerId) ?? "Community member",
						partnerContact: {
							phone:
								typeof profile?.contactPhone === "string"
									? profile.contactPhone
									: null,
							email:
								typeof profile?.contactEmail === "string"
									? profile.contactEmail
									: null,
						},
						minutes:
							asNullableNumber(post.availableMinutes) ??
							asNullableNumber(post.estimatedMinutes) ??
							60,
						status:
							match.status === "completed"
								? "completed"
								: match.status === "awaiting_confirmation"
									? "awaiting_confirmation"
									: "accepted",
						youConfirmed: confirmedBy.includes(userId),
						partnerConfirmed: confirmedBy.includes(partnerId),
						role: providerUserId === userId ? "provider" : "recipient",
						canArchivePost:
							match.status === "completed" &&
							bothVerified &&
							post.status !== "archived",
						...thankYouFields(match),
						audit: mapSolanaAudit(
							exchangesByMatchId.get(match._id.toString())?.audit,
						),
					},
				];
			},
		);

		return {
			isAuthenticated: true,
			items,
			incoming: incoming.filter((item) => item.status === "pending"),
			connections,
		};
	},
);

export const getMyBoardPaginatedFn = createServerFn({ method: "GET" })
	.validator(boardPaginationInputSchema)
	.handler(async ({ data }) => {
		const { isAuthenticated, userId } = await auth();
		const emptyPagination = paginationMeta({
			page: 1,
			pageSize: data.pageSize,
			totalItems: 0,
		});
		if (!isAuthenticated || !userId) {
			return {
				isAuthenticated: false,
				items: [] as BoardItem[],
				incoming: [] as IncomingInterest[],
				connections: [] as ActiveConnection[],
				postsPagination: emptyPagination,
				incomingPagination: emptyPagination,
				connectionsPagination: emptyPagination,
			};
		}

		const database = await connectToDatabase();
		const postStatusFilter =
			data.postFilter === "archived"
				? { $eq: "archived" }
				: { $ne: "archived" };
		const offerFilter = {
			userId,
			status: postStatusFilter,
			...(data.postFilter === "request" ? { _id: { $exists: false } } : {}),
		};
		const requestFilter = {
			userId,
			status: postStatusFilter,
			...(data.postFilter === "offer" ? { _id: { $exists: false } } : {}),
		};
		const connectionFilter = {
			$or: [{ toUserId: userId }, { fromUserId: userId }],
			status: { $in: ["accepted", "awaiting_confirmation", "completed"] },
			hiddenFromBoard: { $ne: true },
			hiddenFromBoardBy: { $ne: userId },
		};
		const [offerCount, requestCount, incomingCount, connectionCount] =
			await Promise.all([
				database.collection("offers").countDocuments(offerFilter),
				database.collection("helpRequests").countDocuments(requestFilter),
				database
					.collection("matches")
					.countDocuments({ toUserId: userId, status: "pending" }),
				database.collection("matches").countDocuments(connectionFilter),
			]);
		const postsPagination = paginationMeta({
			page: data.postsPage,
			pageSize: data.pageSize,
			totalItems: offerCount + requestCount,
		});
		const incomingPagination = paginationMeta({
			page: data.incomingPage,
			pageSize: data.pageSize,
			totalItems: incomingCount,
		});
		const connectionsPagination = paginationMeta({
			page: data.connectionsPage,
			pageSize: data.pageSize,
			totalItems: connectionCount,
		});

		const [postDocuments, incomingMatches, activeMatches] = await Promise.all([
			database
				.collection("offers")
				.aggregate<WithId<Document>>([
					{ $match: offerFilter },
					{ $addFields: { __postType: "offer" } },
					{
						$unionWith: {
							coll: "helpRequests",
							pipeline: [
								{ $match: requestFilter },
								{ $addFields: { __postType: "request" } },
							],
						},
					},
					{ $sort: { createdAt: -1, _id: -1 } },
					{
						$skip: (postsPagination.page - 1) * postsPagination.pageSize,
					},
					{ $limit: postsPagination.pageSize },
				])
				.toArray(),
			database
				.collection("matches")
				.find({ toUserId: userId, status: "pending" })
				.sort({ createdAt: -1, _id: -1 })
				.skip((incomingPagination.page - 1) * incomingPagination.pageSize)
				.limit(incomingPagination.pageSize)
				.toArray(),
			database
				.collection("matches")
				.find(connectionFilter)
				.sort({ updatedAt: -1, createdAt: -1, _id: -1 })
				.skip((connectionsPagination.page - 1) * connectionsPagination.pageSize)
				.limit(connectionsPagination.pageSize)
				.toArray(),
		]);

		const posts = postDocuments.map((document) =>
			mapDocument(
				document,
				document.__postType === "offer" ? "offer" : "request",
				"You",
			),
		);
		const postIds = posts.map((post) => post.id);
		const relatedMatches =
			postIds.length > 0
				? await database
						.collection("matches")
						.find({
							postId: { $in: postIds },
							toUserId: userId,
							status: {
								$in: [
									"pending",
									"accepted",
									"awaiting_confirmation",
									"completed",
								],
							},
						})
						.toArray()
				: [];
		const allIncomingMatches = [
			...relatedMatches,
			...incomingMatches.filter(
				(match) =>
					!relatedMatches.some((related) => related._id.equals(match._id)),
			),
		];
		const incomingNames = await namesFor(
			allIncomingMatches.map((match) => String(match.fromUserId)),
		);
		const incomingPostIds = [
			...new Set(incomingMatches.map((match) => String(match.postId))),
		];
		const incomingPosts = await Promise.all(
			incomingPostIds.map(async (postIdValue) => {
				const match = incomingMatches.find(
					(item) => String(item.postId) === postIdValue,
				);
				const postId = await parseObjectId(postIdValue);
				if (!match || !postId) return null;
				const postType: IntentKind =
					match.postType === "offer" ? "offer" : "request";
				const document = await database
					.collection(collectionFor(postType))
					.findOne({ _id: postId });
				return document ? mapDocument(document, postType, "You") : null;
			}),
		);
		const postsById = new Map([
			...posts.map((post) => [post.id, post] as const),
			...incomingPosts.flatMap((post) =>
				post ? ([[post.id, post]] as const) : [],
			),
		]);
		const mapIncoming = (match: WithId<Document>) => {
			const post = postsById.get(String(match.postId));
			if (!post) return null;
			const status = incomingMatchStatus(match.status);
			return {
				id: match._id.toString(),
				postId: post.id,
				postType: post.type,
				postTitle: post.title,
				fromDisplayName:
					incomingNames.get(String(match.fromUserId)) ?? "Community member",
				score: typeof match.score === "number" ? match.score : 0,
				explanation: asNullableString(match.explanation),
				status,
				createdAt: toIsoDate(match.createdAt),
			} satisfies IncomingInterest;
		};
		const relatedIncoming = relatedMatches
			.map(mapIncoming)
			.filter((item): item is IncomingInterest => item !== null);
		const incoming = incomingMatches
			.map(mapIncoming)
			.filter((item): item is IncomingInterest => item !== null);
		const items: BoardItem[] = posts.map((post) => {
			const related = relatedIncoming.filter((item) => item.postId === post.id);
			const accepted = related.find(
				(item) =>
					item.status === "accepted" || item.status === "awaiting_confirmation",
			);
			const completed = related.find((item) => item.status === "completed");
			const partner = completed ?? accepted ?? null;
			return {
				id: post.id,
				type: post.type,
				title: post.title,
				description: post.description,
				skills: post.skills,
				minutes: post.minutes,
				availability: post.availability,
				status: post.status,
				createdAt: post.createdAt,
				incomingCount: related.filter((item) => item.status === "pending")
					.length,
				partnerName: partner?.fromDisplayName ?? null,
				acceptedMatchId: accepted?.id ?? completed?.id ?? null,
			};
		});

		const partnerIds = activeMatches.map((match) =>
			String(match.fromUserId) === userId
				? String(match.toUserId)
				: String(match.fromUserId),
		);
		const [activeNames, partnerProfiles, connectionPosts, activeExchanges] =
			await Promise.all([
				namesFor(partnerIds),
				database
					.collection("profiles")
					.find({ clerkUserId: { $in: partnerIds } })
					.toArray(),
				Promise.all(
					activeMatches.map(async (match) => {
						const postId = await parseObjectId(String(match.postId));
						if (!postId) return null;
						const postType: IntentKind =
							match.postType === "offer" ? "offer" : "request";
						return database
							.collection(collectionFor(postType))
							.findOne({ _id: postId });
					}),
				),
				database
					.collection("exchanges")
					.find({
						matchId: {
							$in: activeMatches.map((match) => match._id.toString()),
						},
					})
					.toArray(),
			]);
		const profilesById = new Map(
			partnerProfiles.map((profile) => [String(profile.clerkUserId), profile]),
		);
		const exchangesByMatchId = new Map(
			activeExchanges.map((exchange) => [String(exchange.matchId), exchange]),
		);
		const connections: ActiveConnection[] = activeMatches.flatMap(
			(match, index) => {
				const post = connectionPosts[index];
				if (!post || post.status === "archived") return [];
				const fromUserId = String(match.fromUserId);
				const toUserId = String(match.toUserId);
				const partnerId = fromUserId === userId ? toUserId : fromUserId;
				const profile = profilesById.get(partnerId);
				const confirmedBy = asStringArray(match.confirmedBy);
				const bothVerified =
					confirmedBy.includes(fromUserId) && confirmedBy.includes(toUserId);
				const postType: IntentKind =
					match.postType === "offer" ? "offer" : "request";
				const providerUserId = postType === "request" ? fromUserId : toUserId;
				return [
					{
						id: match._id.toString(),
						postTitle: String(post.title),
						postType,
						partnerName: activeNames.get(partnerId) ?? "Community member",
						partnerContact: {
							phone:
								typeof profile?.contactPhone === "string"
									? profile.contactPhone
									: null,
							email:
								typeof profile?.contactEmail === "string"
									? profile.contactEmail
									: null,
						},
						minutes:
							asNullableNumber(post.availableMinutes) ??
							asNullableNumber(post.estimatedMinutes) ??
							60,
						status:
							match.status === "completed"
								? "completed"
								: match.status === "awaiting_confirmation"
									? "awaiting_confirmation"
									: "accepted",
						youConfirmed: confirmedBy.includes(userId),
						partnerConfirmed: confirmedBy.includes(partnerId),
						role: providerUserId === userId ? "provider" : "recipient",
						canArchivePost:
							match.status === "completed" &&
							bothVerified &&
							post.status !== "archived",
						...thankYouFields(match),
						audit: mapSolanaAudit(
							exchangesByMatchId.get(match._id.toString())?.audit,
						),
					},
				];
			},
		);

		return {
			isAuthenticated: true,
			items,
			incoming,
			connections,
			postsPagination,
			incomingPagination,
			connectionsPagination,
		};
	});

export const acceptMatchFn = createServerFn({ method: "POST" })
	.validator(matchActionInputSchema)
	.handler(async ({ data }) => {
		const { isAuthenticated, userId } = await auth();

		if (!isAuthenticated || !userId) {
			throw new Error("You must be signed in to continue");
		}

		const matchId = await parseObjectId(data.matchId);
		if (!matchId) {
			throw new Error("That match could not be found");
		}

		const database = await connectToDatabase();
		const match = await database
			.collection("matches")
			.findOne({ _id: matchId });

		if (!match || String(match.toUserId) !== userId) {
			throw new Error("That match could not be found");
		}

		if (
			match.status === "accepted" ||
			match.status === "awaiting_confirmation" ||
			match.status === "completed"
		) {
			return { id: match._id.toString(), status: String(match.status) };
		}
		if (match.status !== "pending") {
			throw new Error("That reply is no longer active");
		}

		const postType: IntentKind =
			match.postType === "offer" ? "offer" : "request";
		const postId = await parseObjectId(String(match.postId));
		if (!postId) {
			throw new Error("That post could not be found");
		}
		const post = await database.collection(collectionFor(postType)).findOne({
			_id: postId,
			status: { $ne: "archived" },
			archivedAt: { $exists: false },
		});

		if (!post || String(post.userId) !== userId) {
			throw new Error("That post could not be found");
		}

		if (post.status === "completed") {
			throw new Error("This post is already completed");
		}

		const now = new Date();

		await database.collection("matches").updateOne(
			{ _id: match._id },
			{
				$set: {
					status: "accepted",
					confirmedBy: [],
					acceptedAt: now,
					updatedAt: now,
				},
			},
		);
		await database
			.collection(collectionFor(postType))
			.updateOne(
				{ _id: post._id },
				{ $set: { status: "matched", updatedAt: now } },
			);

		const names = await namesFor([userId]);
		await createNotification(database, {
			userId: String(match.fromUserId),
			actorUserId: userId,
			type: "match_accepted",
			title: "Your reply was accepted",
			body: `${names.get(userId) ?? "Someone"} accepted you for “${String(post.title)}”.`,
			href: "/requests",
			entityId: `accepted:${match._id.toString()}`,
		});

		return { id: match._id.toString(), status: "accepted" };
	});

export const completeMatchFn = createServerFn({ method: "POST" })
	.validator(matchActionInputSchema)
	.handler(async ({ data }) => {
		const { isAuthenticated, userId } = await auth();

		if (!isAuthenticated || !userId) {
			throw new Error("You must be signed in to continue");
		}

		const matchId = await parseObjectId(data.matchId);
		if (!matchId) {
			throw new Error("That match could not be found");
		}

		const database = await connectToDatabase();
		const result = await confirmExchange({ database, matchId, userId });
		const audit =
			result.status === "completed"
				? await ensureSolanaAudit({
						database,
						matchId: matchId.toString(),
					})
				: null;
		const match = await database
			.collection("matches")
			.findOne({ _id: matchId });
		if (match) {
			const partnerId =
				String(match.fromUserId) === userId
					? String(match.toUserId)
					: String(match.fromUserId);
			const names = await namesFor([userId]);
			const postType: IntentKind =
				match.postType === "offer" ? "offer" : "request";
			const postId = await parseObjectId(String(match.postId));
			const post = postId
				? await database.collection(collectionFor(postType)).findOne({
						_id: postId,
					})
				: null;
			const postTitle = post ? String(post.title) : "your match";
			const actorName = names.get(userId) ?? "Someone";
			if (result.status === "awaiting_confirmation") {
				await createNotification(database, {
					userId: partnerId,
					actorUserId: userId,
					type: "hours_confirmed",
					title: "Hours are waiting on you",
					body: `${actorName} confirmed time on “${postTitle}”.`,
					href: "/requests",
					entityId: `hours:${match._id.toString()}:${userId}`,
				});
			} else if (result.status === "completed") {
				const providerUserId =
					postType === "request"
						? String(match.fromUserId)
						: String(match.toUserId);
				const recipientUserId =
					postType === "request"
						? String(match.toUserId)
						: String(match.fromUserId);
				const helperNames = await namesFor([providerUserId]);
				const helperName = helperNames.get(providerUserId) ?? "Someone";
				if (postType === "request") {
					await createNotification(database, {
						userId: recipientUserId,
						actorUserId: providerUserId,
						type: "request_fulfilled",
						title: "Your request was fulfilled",
						body: `“${postTitle}” is complete. You can send ${helperName} a thank-you.`,
						href: "/requests",
						entityId: `fulfilled:${match._id.toString()}`,
					});
					await createNotification(database, {
						userId: providerUserId,
						actorUserId: userId,
						type: "exchange_completed",
						title: "Both people verified the hours",
						body: `“${postTitle}” is complete and ready to archive.`,
						href: "/requests",
						entityId: `completed:${match._id.toString()}:${providerUserId}`,
					});
				} else {
					await Promise.all(
						[partnerId, userId].map((notifyUserId) =>
							createNotification(database, {
								userId: notifyUserId,
								actorUserId: userId,
								type: "exchange_completed",
								title: "Both people verified the hours",
								body: `“${postTitle}” is complete and ready to archive.`,
								href: "/requests",
								entityId: `completed:${match._id.toString()}:${notifyUserId}`,
							}),
						),
					);
				}
			}
		}
		return { ...result, audit };
	});

export const sendThankYouFn = createServerFn({ method: "POST" })
	.validator(sendThankYouInputSchema)
	.handler(async ({ data }) => {
		const { isAuthenticated, userId } = await auth();
		if (!isAuthenticated || !userId) {
			throw new Error("You must be signed in to continue");
		}

		const message = sanitizeThankYouMessage(data.message);
		if (message.length < 2) {
			throw new Error("Write a short note first.");
		}

		const matchId = await parseObjectId(data.matchId);
		if (!matchId) throw new Error("That match could not be found");

		const database = await connectToDatabase();
		const match = await database.collection("matches").findOne({
			_id: matchId,
			status: "completed",
			$or: [{ fromUserId: userId }, { toUserId: userId }],
		});
		if (!match) throw new Error("That completed match could not be found");

		const confirmedBy = asStringArray(match.confirmedBy);
		if (
			!confirmedBy.includes(String(match.fromUserId)) ||
			!confirmedBy.includes(String(match.toUserId))
		) {
			throw new Error("Both people must verify the exchange first");
		}

		const existing = thankYouFields(match);
		if (existing.thankYouSent) {
			throw new Error("A thank-you was already sent for this match");
		}

		const postType: IntentKind =
			match.postType === "offer" ? "offer" : "request";
		const providerUserId =
			postType === "request"
				? String(match.fromUserId)
				: String(match.toUserId);
		const recipientUserId =
			postType === "request"
				? String(match.toUserId)
				: String(match.fromUserId);

		if (userId !== recipientUserId) {
			throw new Error("Only the person who received help can send a thank-you");
		}

		const now = new Date();
		await database.collection("matches").updateOne(
			{ _id: matchId, "thankYou.message": { $exists: false } },
			{
				$set: {
					thankYou: {
						message,
						fromUserId: userId,
						toUserId: providerUserId,
						sentAt: now,
					},
					updatedAt: now,
				},
			},
		);

		const names = await namesFor([userId]);
		const actorName = names.get(userId) ?? "Someone";
		await createNotification(database, {
			userId: providerUserId,
			actorUserId: userId,
			type: "thank_you_received",
			title: `A thank-you from ${actorName}`,
			body: message,
			href: "/requests",
			entityId: `thankyou:${match._id.toString()}`,
		});

		return { sent: true as const };
	});

export const archiveCompletedPostFn = createServerFn({ method: "POST" })
	.validator(matchActionInputSchema)
	.handler(async ({ data }) => {
		const { isAuthenticated, userId } = await auth();
		if (!isAuthenticated || !userId) {
			throw new Error("You must be signed in to continue");
		}

		const matchId = await parseObjectId(data.matchId);
		if (!matchId) throw new Error("That match could not be found");

		const database = await connectToDatabase();
		const match = await database.collection("matches").findOne({
			_id: matchId,
			status: "completed",
			$or: [{ fromUserId: userId }, { toUserId: userId }],
		});
		if (!match) throw new Error("That completed match could not be found");

		const confirmedBy = asStringArray(match.confirmedBy);
		if (
			!confirmedBy.includes(String(match.fromUserId)) ||
			!confirmedBy.includes(String(match.toUserId))
		) {
			throw new Error("Both people must verify the exchange first");
		}

		const postId = await parseObjectId(String(match.postId));
		if (!postId) throw new Error("That post could not be found");

		const postType: IntentKind =
			match.postType === "offer" ? "offer" : "request";
		const ownedPost = await database
			.collection(collectionFor(postType))
			.findOne({
				_id: postId,
				userId,
			});
		if (ownedPost) {
			return archiveOwnedIntent({
				database,
				postId,
				postType,
				userId,
				allowCompleted: true,
			});
		}

		const now = new Date();
		await database.collection("matches").updateOne(
			{
				_id: matchId,
				$or: [{ fromUserId: userId }, { toUserId: userId }],
			},
			{
				$addToSet: { hiddenFromBoardBy: userId },
				$set: { updatedAt: now },
			},
		);
		return { ok: true as const, archived: true as const };
	});

export const retrySolanaAuditFn = createServerFn({ method: "POST" })
	.validator(matchActionInputSchema)
	.handler(async ({ data }) => {
		const { isAuthenticated, userId } = await auth();

		if (!isAuthenticated || !userId) {
			throw new Error("You must be signed in to continue");
		}

		const matchId = await parseObjectId(data.matchId);
		if (!matchId) {
			throw new Error("That match could not be found");
		}

		const database = await connectToDatabase();
		const match = await database.collection("matches").findOne({
			_id: matchId,
			status: "completed",
			$or: [{ fromUserId: userId }, { toUserId: userId }],
		});
		if (!match) {
			throw new Error("That completed match could not be found");
		}

		await confirmExchange({ database, matchId, userId });
		return ensureSolanaAudit({
			database,
			matchId: matchId.toString(),
		});
	});

export const getPublicAuditReceiptFn = createServerFn({ method: "GET" })
	.validator(auditLookupInputSchema)
	.handler(async ({ data }) => {
		const config = await getSolanaAuditPublicConfig();
		const receipt = data.receipt?.trim();
		if (!receipt) return { config, searched: false, receipt: null };

		const database = await connectToDatabase();
		const exchange = await database.collection("exchanges").findOne({
			status: "completed",
			verifiedByBoth: true,
			"audit.status": "confirmed",
			$or: [
				{ "audit.receiptId": receipt },
				{ "audit.receiptHash": receipt },
				{ "audit.signature": receipt },
			],
		});
		const audit = mapSolanaAudit(exchange?.audit);
		if (!exchange || !audit) {
			return { config, searched: true, receipt: null };
		}

		return {
			config,
			searched: true,
			receipt: {
				minutes: typeof exchange.minutes === "number" ? exchange.minutes : 0,
				completedAt: toIsoDate(exchange.completedAt ?? exchange.createdAt),
				audit,
			},
		};
	});

export const getImpactFn = createServerFn({ method: "GET" })
	.validator(paginationInputSchema)
	.handler(async ({ data }) => {
		const { isAuthenticated, userId } = await auth();
		const emptyPagination = paginationMeta({
			page: 1,
			pageSize: data.pageSize,
			totalItems: 0,
		});

		if (!isAuthenticated || !userId) {
			return {
				isAuthenticated: false,
				posts: 0,
				peopleReached: 0,
				minutesPledged: 0,
				verifiedMinutes: 0,
				auditedMinutes: 0,
				availableCredits: 0,
				skills: [] as string[],
				pagination: emptyPagination,
				recent: [] as Array<{
					id: string;
					type: IntentKind;
					title: string;
					description: string;
					skills: string[];
					minutes: number | null;
					availability: string | null;
					status: CommunityPost["status"];
					createdAt: string;
				}>,
			};
		}

		const database = await connectToDatabase();
		const [postSummary, peopleResult, exchangeSummary, profile] =
			await Promise.all([
				database
					.collection("offers")
					.aggregate<{
						posts: number;
						minutesPledged: number;
						skillArrays: string[][];
					}>([
						...impactPostPipeline(userId),
						{
							$group: {
								_id: null,
								posts: { $sum: 1 },
								minutesPledged: { $sum: "$__minutes" },
								skillArrays: { $push: "$__skills" },
							},
						},
					])
					.toArray(),
				database
					.collection("matches")
					.aggregate<{ total: number }>([
						{ $match: { $or: [{ fromUserId: userId }, { toUserId: userId }] } },
						{
							$project: {
								otherUserId: {
									$cond: [
										{ $eq: ["$fromUserId", userId] },
										"$toUserId",
										"$fromUserId",
									],
								},
							},
						},
						{ $match: { otherUserId: { $type: "string", $ne: userId } } },
						{ $group: { _id: "$otherUserId" } },
						{ $count: "total" },
					])
					.toArray(),
				database
					.collection("exchanges")
					.aggregate<{ verifiedMinutes: number; auditedMinutes: number }>([
						{
							$match: {
								status: "completed",
								verifiedByBoth: true,
								$or: [{ providerUserId: userId }, { recipientUserId: userId }],
							},
						},
						{
							$group: {
								_id: null,
								verifiedMinutes: { $sum: "$minutes" },
								auditedMinutes: {
									$sum: {
										$cond: [
											{ $eq: ["$audit.status", "confirmed"] },
											"$minutes",
											0,
										],
									},
								},
							},
						},
					])
					.toArray(),
				database.collection("profiles").findOne({ clerkUserId: userId }),
			]);
		const summary = postSummary[0];
		const pageInfo = paginationMeta({
			page: data.page,
			pageSize: data.pageSize,
			totalItems: summary?.posts ?? 0,
		});
		const recentDocuments = await database
			.collection("offers")
			.aggregate<WithId<Document>>([
				...impactPostPipeline(userId),
				{ $sort: { createdAt: -1, _id: -1 } },
				{ $skip: (pageInfo.page - 1) * pageInfo.pageSize },
				{ $limit: pageInfo.pageSize },
			])
			.toArray();
		const recent = recentDocuments
			.map((document) =>
				mapDocument(
					document,
					document.__postType === "offer" ? "offer" : "request",
					"You",
				),
			)
			.map(({ userId: _userId, displayName: _displayName, ...item }) => item);

		return {
			isAuthenticated: true,
			posts: summary?.posts ?? 0,
			peopleReached: peopleResult[0]?.total ?? 0,
			minutesPledged: summary?.minutesPledged ?? 0,
			verifiedMinutes: exchangeSummary[0]?.verifiedMinutes ?? 0,
			auditedMinutes: exchangeSummary[0]?.auditedMinutes ?? 0,
			availableCredits:
				typeof profile?.availableCredits === "number"
					? profile.availableCredits
					: 0,
			pagination: pageInfo,
			skills: uniqueSkills(summary?.skillArrays.flat() ?? []).slice(0, 12),
			recent,
		};
	});

export const getLeaderboardFn = createServerFn({ method: "GET" })
	.validator(paginationInputSchema)
	.handler(async ({ data }) => {
		const database = await connectToDatabase();
		const basePipeline: Document[] = [
			{ $match: { status: "completed", verifiedByBoth: true } },
			{
				$group: {
					_id: "$providerUserId",
					verifiedMinutes: { $sum: "$minutes" },
					exchanges: { $sum: 1 },
				},
			},
			{
				$lookup: {
					from: "profiles",
					localField: "_id",
					foreignField: "clerkUserId",
					as: "profile",
				},
			},
			{ $match: { "profile.discoverable": { $ne: false } } },
		];
		const countResult = await database
			.collection("exchanges")
			.aggregate<{ total: number }>([...basePipeline, { $count: "total" }])
			.toArray();
		const pageInfo = paginationMeta({
			page: data.page,
			pageSize: data.pageSize,
			totalItems: countResult[0]?.total ?? 0,
		});
		const totals = await database
			.collection("exchanges")
			.aggregate<{
				_id: string;
				verifiedMinutes: number;
				exchanges: number;
			}>([
				...basePipeline,
				{ $sort: { verifiedMinutes: -1, exchanges: -1 } },
				{ $skip: (pageInfo.page - 1) * pageInfo.pageSize },
				{ $limit: pageInfo.pageSize },
			])
			.toArray();

		const userIds = totals.map((item) => String(item._id)).filter(Boolean);
		if (userIds.length === 0) {
			return { entries: [] as LeaderboardEntry[], pagination: pageInfo };
		}

		const [profiles, names] = await Promise.all([
			database
				.collection("profiles")
				.find({ clerkUserId: { $in: userIds } })
				.toArray(),
			namesFor(userIds),
		]);
		const profilesById = new Map(
			profiles.map((profile) => [String(profile.clerkUserId), profile]),
		);

		const entries: LeaderboardEntry[] = totals.map((item, index) => {
			const userId = String(item._id);
			const profile = profilesById.get(userId);
			return {
				rank: (pageInfo.page - 1) * pageInfo.pageSize + index + 1,
				userId,
				displayName:
					(typeof profile?.displayName === "string" &&
					profile.displayName.trim()
						? profile.displayName
						: names.get(userId)) ?? "Community member",
				verifiedMinutes: Math.max(1, Math.round(item.verifiedMinutes)),
				exchanges: Math.max(1, Math.round(item.exchanges)),
				skills: uniqueSkills(asStringArray(profile?.skills)).slice(0, 4),
			};
		});

		return { entries, pagination: pageInfo };
	});

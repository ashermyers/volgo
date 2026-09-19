import { auth, clerkClient } from "@clerk/tanstack-react-start/server";
import { createServerFn } from "@tanstack/react-start";
import type { Document, WithId } from "mongodb";

import {
	type ActiveConnection,
	type BoardItem,
	type CommunityPost,
	expressInterestInputSchema,
	type IncomingInterest,
	type LeaderboardEntry,
	matchActionInputSchema,
} from "#/features/community/schema";
import { connectToDatabase, parseObjectId } from "#/lib/db";
import { confirmExchange } from "#/lib/exchanges";
import type { IntentKind } from "#/lib/matching";
import { scoreOpportunity } from "#/lib/matching";

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

function toIsoDate(value: unknown) {
	if (value instanceof Date) return value.toISOString();
	return new Date(String(value)).toISOString();
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
			document.status === "open"
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

export const getDiscoverFeedFn = createServerFn({ method: "GET" }).handler(
	async () => {
		const { isAuthenticated, userId } = await auth();
		const database = await connectToDatabase();

		const [offers, requests, interests] = await Promise.all([
			database
				.collection("offers")
				.find({
					status: { $in: ["active", "matched"] },
					...(userId ? { userId: { $ne: userId } } : {}),
				})
				.sort({ createdAt: -1 })
				.limit(40)
				.toArray(),
			database
				.collection("helpRequests")
				.find({
					status: { $in: ["open", "matched", "active"] },
					...(userId ? { userId: { $ne: userId } } : {}),
				})
				.sort({ createdAt: -1 })
				.limit(40)
				.toArray(),
			userId
				? database
						.collection("matches")
						.find({ fromUserId: userId })
						.project({ postId: 1 })
						.toArray()
				: Promise.resolve([]),
		]);

		const interestedIds = new Set(
			interests.map((interest) => String(interest.postId)),
		);

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

		const names = await namesFor([
			...offers.map((offer) => String(offer.userId)),
			...requests.map((request) => String(request.userId)),
		]);

		const items: CommunityPost[] = [
			...offers.map((offer) => {
				const base = mapDocument(
					offer,
					"offer",
					names.get(String(offer.userId)) ?? "Community member",
				);
				const match = userId
					? scoreOpportunity({
							postType: "offer",
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
			}),
			...requests.map((request) => {
				const base = mapDocument(
					request,
					"request",
					names.get(String(request.userId)) ?? "Community member",
				);
				const match = userId
					? scoreOpportunity({
							postType: "request",
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
			}),
		];

		items.sort((left, right) => {
			const scoreDelta = (right.matchScore ?? 0) - (left.matchScore ?? 0);
			if (scoreDelta !== 0) return scoreDelta;
			return right.createdAt.localeCompare(left.createdAt);
		});

		return {
			isAuthenticated,
			items,
			hasProfileSignal:
				userContext.offerSkills.length > 0 ||
				userContext.requestSkills.length > 0,
		};
	},
);

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
		const post = await database
			.collection(collectionName)
			.findOne({ _id: postId });

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

		if (existing) {
			return { id: existing._id.toString(), alreadySent: true };
		}

		const mapped = mapDocument(post, data.postType, "Community member");
		const [myOffers, myRequests] = await Promise.all([
			database.collection("offers").find({ userId }).toArray(),
			database.collection("helpRequests").find({ userId }).toArray(),
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
		const result = await database.collection("matches").insertOne({
			postId: data.postId,
			postType: data.postType,
			fromUserId: userId,
			toUserId: String(post.userId),
			score: match.score,
			explanation: match.explanation,
			status: "pending",
			createdAt: now,
		});

		return { id: result.insertedId.toString(), alreadySent: false };
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
				.find({ $or: [{ toUserId: userId }, { fromUserId: userId }] })
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

			const status =
				match.status === "accepted" ||
				match.status === "awaiting_confirmation" ||
				match.status === "completed"
					? match.status
					: "pending";

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
		const [activeNames, partnerProfiles, connectionPosts] = await Promise.all([
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
		]);
		const profilesById = new Map(
			partnerProfiles.map((profile) => [String(profile.clerkUserId), profile]),
		);

		const connections: ActiveConnection[] = activeMatches.flatMap(
			(match, index) => {
				const post = connectionPosts[index];
				if (!post) return [];

				const fromUserId = String(match.fromUserId);
				const toUserId = String(match.toUserId);
				const partnerId = fromUserId === userId ? toUserId : fromUserId;
				const profile = profilesById.get(partnerId);
				const confirmedBy = asStringArray(match.confirmedBy);
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

		if (match.status === "accepted" || match.status === "completed") {
			return { id: match._id.toString(), status: String(match.status) };
		}

		const postType: IntentKind =
			match.postType === "offer" ? "offer" : "request";
		const postId = await parseObjectId(String(match.postId));
		if (!postId) {
			throw new Error("That post could not be found");
		}
		const post = await database
			.collection(collectionFor(postType))
			.findOne({ _id: postId });

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
		return confirmExchange({ database, matchId, userId });
	});

export const getImpactFn = createServerFn({ method: "GET" }).handler(
	async () => {
		const { isAuthenticated, userId } = await auth();

		if (!isAuthenticated || !userId) {
			return {
				isAuthenticated: false,
				posts: 0,
				peopleReached: 0,
				minutesPledged: 0,
				verifiedMinutes: 0,
				availableCredits: 0,
				skills: [] as string[],
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
		const [offers, requests, matches, exchanges, profile] = await Promise.all([
			database
				.collection("offers")
				.find({ userId })
				.sort({ createdAt: -1 })
				.toArray(),
			database
				.collection("helpRequests")
				.find({ userId })
				.sort({ createdAt: -1 })
				.toArray(),
			database
				.collection("matches")
				.find({ $or: [{ fromUserId: userId }, { toUserId: userId }] })
				.toArray(),
			database
				.collection("exchanges")
				.find({
					status: "completed",
					verifiedByBoth: true,
					$or: [{ providerUserId: userId }, { recipientUserId: userId }],
				})
				.toArray(),
			database.collection("profiles").findOne({ clerkUserId: userId }),
		]);

		const people = new Set<string>();
		for (const match of matches) {
			if (typeof match.fromUserId === "string" && match.fromUserId !== userId) {
				people.add(match.fromUserId);
			}
			if (typeof match.toUserId === "string" && match.toUserId !== userId) {
				people.add(match.toUserId);
			}
		}

		const mappedOffers = offers.map((offer) =>
			mapDocument(offer, "offer", "You"),
		);
		const mappedRequests = requests.map((request) =>
			mapDocument(request, "request", "You"),
		);
		const recent = [...mappedOffers, ...mappedRequests]
			.sort((left, right) => right.createdAt.localeCompare(left.createdAt))
			.slice(0, 6)
			.map(({ userId: _userId, displayName: _displayName, ...item }) => item);

		const minutesPledged = [...offers, ...requests].reduce((total, item) => {
			const minutes =
				asNullableNumber(item.availableMinutes) ??
				asNullableNumber(item.estimatedMinutes) ??
				0;
			return total + minutes;
		}, 0);
		const verifiedMinutes = exchanges.reduce(
			(total, exchange) =>
				total + (typeof exchange.minutes === "number" ? exchange.minutes : 0),
			0,
		);

		return {
			isAuthenticated: true,
			posts: offers.length + requests.length,
			peopleReached: people.size,
			minutesPledged,
			verifiedMinutes,
			availableCredits:
				typeof profile?.availableCredits === "number"
					? profile.availableCredits
					: 0,
			skills: uniqueSkills([
				...offers.flatMap((offer) => asStringArray(offer.skills)),
				...requests.flatMap((request) => asStringArray(request.skillsNeeded)),
			]).slice(0, 12),
			recent,
		};
	},
);

export const getLeaderboardFn = createServerFn({ method: "GET" }).handler(
	async () => {
		const database = await connectToDatabase();
		const totals = await database
			.collection("exchanges")
			.aggregate<{
				_id: string;
				verifiedMinutes: number;
				exchanges: number;
			}>([
				{ $match: { status: "completed", verifiedByBoth: true } },
				{
					$group: {
						_id: "$providerUserId",
						verifiedMinutes: { $sum: "$minutes" },
						exchanges: { $sum: 1 },
					},
				},
				{ $sort: { verifiedMinutes: -1, exchanges: -1 } },
				{ $limit: 25 },
			])
			.toArray();

		const userIds = totals.map((item) => String(item._id)).filter(Boolean);
		if (userIds.length === 0) return { entries: [] as LeaderboardEntry[] };

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

		const visible = totals.filter((item) => {
			const profile = profilesById.get(String(item._id));
			return profile?.discoverable !== false;
		});
		const entries: LeaderboardEntry[] = visible.map((item, index) => {
			const userId = String(item._id);
			const profile = profilesById.get(userId);
			return {
				rank: index + 1,
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

		return { entries };
	},
);

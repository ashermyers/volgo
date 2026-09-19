import { auth, clerkClient } from "@clerk/tanstack-react-start/server";
import { chat } from "@tanstack/ai";
import { createGeminiChat } from "@tanstack/ai-gemini";
import { createServerFn } from "@tanstack/react-start";
import type { Document, WithId } from "mongodb";

import type { CommunityPost } from "#/features/community/schema";
import { paginationMeta } from "#/features/pagination/schema";
import {
	onboardingInputSchema,
	type PublicProfile,
	resumeSummarySchema,
	resumeUploadInputSchema,
	searchCommunityInputSchema,
	type UserProfile,
	updateProfileInputSchema,
} from "#/features/profiles/schema";
import { connectToDatabase } from "#/lib/db";

function asStringArray(value: unknown) {
	return Array.isArray(value)
		? value.filter((item): item is string => typeof item === "string")
		: [];
}

function unique(values: string[]) {
	const seen = new Set<string>();
	const result: string[] = [];

	for (const value of values) {
		const key = value.trim();
		if (!key || seen.has(key.toLowerCase())) continue;
		seen.add(key.toLowerCase());
		result.push(key);
	}

	return result;
}

function escapeRegex(value: string) {
	return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const RESUME_SYSTEM_PROMPT = `You turn a resume into a concise VOLGO community profile.

Return:
- bio: 2-3 warm, first-person sentences (maximum 400 characters) focused on how the person can help others.
- skills: up to 12 short, concrete skills explicitly supported by the resume.
- interests: up to 8 broad service or project interests reasonably supported by the resume.

Do not include phone numbers, email addresses, street addresses, GPA, student IDs, employer contact details, or other sensitive data. Do not invent credentials or experience. Avoid corporate jargon.`;

function getResumeGeminiAdapter() {
	const apiKey = process.env.GEMINI_API_KEY;
	if (!apiKey) throw new Error("GEMINI_API_KEY is not configured");
	return createGeminiChat("gemini-3.1-pro-preview", apiKey);
}

function emptyProfile(userId: string, displayName: string): UserProfile {
	return {
		clerkUserId: userId,
		displayName,
		bio: "",
		skills: [],
		interests: [],
		availability: "",
		campusArea: "",
		discoverable: true,
		notifyOnInterest: true,
		lifetimeMinutes: 0,
		availableCredits: 0,
	};
}

function mapProfile(
	document: WithId<Document> | null,
	userId: string,
	displayName: string,
): UserProfile {
	if (!document) return emptyProfile(userId, displayName);

	return {
		clerkUserId: userId,
		displayName:
			typeof document.displayName === "string" && document.displayName.trim()
				? document.displayName
				: displayName,
		bio: typeof document.bio === "string" ? document.bio : "",
		skills: unique(asStringArray(document.skills)),
		interests: unique(asStringArray(document.interests)),
		availability:
			typeof document.availability === "string" ? document.availability : "",
		campusArea:
			typeof document.campusArea === "string" ? document.campusArea : "",
		discoverable: document.discoverable !== false,
		notifyOnInterest: document.notifyOnInterest !== false,
		lifetimeMinutes:
			typeof document.lifetimeMinutes === "number"
				? document.lifetimeMinutes
				: 0,
		availableCredits:
			typeof document.availableCredits === "number"
				? document.availableCredits
				: 0,
	};
}

async function displayNameFor(userId: string) {
	try {
		const user = await clerkClient().users.getUser(userId);
		return user.firstName || user.username || "Community member";
	} catch {
		return "Community member";
	}
}

export async function mergeSkillsIntoProfile({
	userId,
	displayName,
	skills,
	availability,
}: {
	userId: string;
	displayName: string;
	skills: string[];
	availability: string | null;
}) {
	const database = await connectToDatabase();
	const existing = await database
		.collection("profiles")
		.findOne({ clerkUserId: userId });
	const current = mapProfile(existing, userId, displayName);
	const now = new Date();

	await database.collection("profiles").updateOne(
		{ clerkUserId: userId },
		{
			$set: {
				clerkUserId: userId,
				displayName: current.displayName || displayName,
				skills: unique([...current.skills, ...skills]),
				availability: availability ?? current.availability,
				updatedAt: now,
			},
			$setOnInsert: {
				bio: current.bio,
				interests: current.interests,
				campusArea: current.campusArea,
				discoverable: true,
				notifyOnInterest: true,
				lifetimeMinutes: 0,
				availableCredits: 0,
				createdAt: now,
			},
		},
		{ upsert: true },
	);
}

async function requireUserId() {
	const { isAuthenticated, userId } = await auth();

	if (!isAuthenticated || !userId) {
		throw new Error("You must be signed in to continue");
	}

	return userId;
}

export const getMyProfileFn = createServerFn({ method: "GET" }).handler(
	async () => {
		const { isAuthenticated, userId } = await auth();

		if (!isAuthenticated || !userId) {
			return {
				isAuthenticated: false,
				profile: null as UserProfile | null,
				contact: null as { phone: string; email: string } | null,
			};
		}

		const database = await connectToDatabase();
		const [document, displayName] = await Promise.all([
			database.collection("profiles").findOne({ clerkUserId: userId }),
			displayNameFor(userId),
		]);

		return {
			isAuthenticated: true,
			profile: mapProfile(document, userId, displayName),
			contact: {
				phone:
					typeof document?.contactPhone === "string"
						? document.contactPhone
						: "",
				email:
					typeof document?.contactEmail === "string"
						? document.contactEmail
						: "",
			},
		};
	},
);

export const summarizeResumeFn = createServerFn({ method: "POST" })
	.validator(resumeUploadInputSchema)
	.handler(async ({ data }) => {
		const userId = await requireUserId();

		const bytes = new Uint8Array(Buffer.from(data.base64, "base64"));
		if (bytes.byteLength > 5_000_000) {
			throw new Error("Resume files must be 5 MB or smaller");
		}

		let resumeText = "";
		if (data.mimeType === "application/pdf") {
			const { extractText } = await import("unpdf");
			const extracted = await extractText(bytes, { mergePages: true });
			resumeText = extracted.text;
		} else {
			resumeText = new TextDecoder().decode(bytes);
		}

		const normalizedText = resumeText
			.split("\u0000")
			.join("")
			.replace(/[ \t]+/g, " ")
			.trim()
			.slice(0, 30_000);
		if (normalizedText.length < 80) {
			throw new Error("We couldn't find enough readable text in that resume");
		}

		const result = await chat({
			adapter: getResumeGeminiAdapter(),
			messages: [
				{
					role: "user",
					content: `Resume filename: ${data.name}\n\nResume text:\n${normalizedText}`,
				},
			],
			systemPrompts: [RESUME_SYSTEM_PROMPT],
			outputSchema: resumeSummarySchema,
		});

		const summary = resumeSummarySchema.parse(result);
		const database = await connectToDatabase();
		await database.collection("profiles").updateOne(
			{ clerkUserId: userId },
			{
				$set: {
					resumeImportedAt: new Date(),
					resumeDraft: summary,
				},
				$setOnInsert: {
					lifetimeMinutes: 0,
					availableCredits: 0,
					createdAt: new Date(),
				},
			},
			{ upsert: true },
		);

		return summary;
	});

export const getOnboardingStateFn = createServerFn({ method: "GET" }).handler(
	async () => {
		const { isAuthenticated, userId } = await auth();

		if (!isAuthenticated || !userId) {
			return {
				isAuthenticated: false,
				completed: false,
				profile: null,
				contact: null,
				resumeImported: false,
			};
		}

		const database = await connectToDatabase();
		const [document, user] = await Promise.all([
			database.collection("profiles").findOne({ clerkUserId: userId }),
			clerkClient().users.getUser(userId),
		]);
		const displayName = user.firstName || user.username || "Community member";
		const email =
			typeof document?.contactEmail === "string"
				? document.contactEmail
				: (user.primaryEmailAddress?.emailAddress ?? "");

		const baseProfile = mapProfile(document, userId, displayName);
		const resumeDraft = resumeSummarySchema.safeParse(document?.resumeDraft);

		return {
			isAuthenticated: true,
			completed: document?.onboardingCompleted === true,
			resumeImported: document?.resumeImportedAt instanceof Date,
			profile: resumeDraft.success
				? {
						...baseProfile,
						bio: resumeDraft.data.bio,
						skills: resumeDraft.data.skills,
						interests: resumeDraft.data.interests,
					}
				: baseProfile,
			contact: {
				phone:
					typeof document?.contactPhone === "string"
						? document.contactPhone
						: "",
				email,
			},
		};
	},
);

export const getOnboardingStatusFn = createServerFn({ method: "GET" }).handler(
	async () => {
		const { isAuthenticated, userId } = await auth();
		if (!isAuthenticated || !userId) {
			return { isAuthenticated: false, completed: false };
		}

		const database = await connectToDatabase();
		const document = await database
			.collection("profiles")
			.findOne(
				{ clerkUserId: userId },
				{ projection: { onboardingCompleted: 1 } },
			);

		return {
			isAuthenticated: true,
			completed: document?.onboardingCompleted === true,
		};
	},
);

export const completeOnboardingFn = createServerFn({ method: "POST" })
	.validator(onboardingInputSchema)
	.handler(async ({ data }) => {
		const userId = await requireUserId();
		const database = await connectToDatabase();
		const existing = await database
			.collection("profiles")
			.findOne(
				{ clerkUserId: userId },
				{ projection: { resumeImportedAt: 1 } },
			);
		if (!(existing?.resumeImportedAt instanceof Date)) {
			throw new Error("Upload and review your resume before finishing setup");
		}
		const now = new Date();

		await database.collection("profiles").updateOne(
			{ clerkUserId: userId },
			{
				$set: {
					clerkUserId: userId,
					displayName: data.displayName,
					bio: data.bio,
					skills: unique(data.skills),
					interests: unique(data.interests),
					availability: data.availability,
					campusArea: data.campusArea,
					contactPhone: data.phone || null,
					contactEmail: data.email || null,
					onboardingCompleted: true,
					discoverable: true,
					notifyOnInterest: true,
					updatedAt: now,
				},
				$setOnInsert: {
					lifetimeMinutes: 0,
					availableCredits: 0,
					createdAt: now,
				},
				$unset: { resumeDraft: "" },
			},
			{ upsert: true },
		);

		return { ok: true as const };
	});

export const getPublicProfileFn = createServerFn({ method: "GET" })
	.validator((data: { userId: string }) => data)
	.handler(async ({ data }): Promise<PublicProfile | null> => {
		const { userId: viewerId } = await auth();
		const database = await connectToDatabase();
		const document = await database
			.collection("profiles")
			.findOne({ clerkUserId: data.userId });
		const displayName = await displayNameFor(data.userId);
		const profile = mapProfile(document, data.userId, displayName);
		const isSelf = viewerId === data.userId;

		if (!profile.discoverable && !isSelf) {
			return null;
		}

		const [offers, requests] = await Promise.all([
			database
				.collection("offers")
				.find({ userId: data.userId, status: { $ne: "archived" } })
				.sort({ createdAt: -1 })
				.limit(8)
				.toArray(),
			database
				.collection("helpRequests")
				.find({ userId: data.userId, status: { $ne: "archived" } })
				.sort({ createdAt: -1 })
				.limit(8)
				.toArray(),
		]);

		const postSkills = unique([
			...offers.flatMap((offer) => asStringArray(offer.skills)),
			...requests.flatMap((request) => asStringArray(request.skillsNeeded)),
		]);
		const postName = [...offers, ...requests]
			.map((item) =>
				typeof item.displayName === "string" ? item.displayName : "",
			)
			.find((name) => name.trim());

		return {
			...profile,
			displayName: document
				? profile.displayName
				: postName || profile.displayName,
			skills: unique([...profile.skills, ...postSkills]),
			isSelf,
			recentTitles: [...offers, ...requests]
				.map((item) => String(item.title ?? ""))
				.filter(Boolean)
				.slice(0, 4),
		};
	});

export const updateProfileFn = createServerFn({ method: "POST" })
	.validator(updateProfileInputSchema)
	.handler(async ({ data }) => {
		const userId = await requireUserId();
		const database = await connectToDatabase();
		const now = new Date();

		await database.collection("profiles").updateOne(
			{ clerkUserId: userId },
			{
				$set: {
					clerkUserId: userId,
					displayName: data.displayName,
					bio: data.bio,
					skills: unique(data.skills),
					interests: unique(data.interests),
					availability: data.availability,
					campusArea: data.campusArea,
					discoverable: data.discoverable,
					notifyOnInterest: data.notifyOnInterest,
					...(data.phone !== undefined
						? { contactPhone: data.phone || null }
						: {}),
					...(data.email !== undefined
						? { contactEmail: data.email || null }
						: {}),
					updatedAt: now,
				},
				$setOnInsert: {
					lifetimeMinutes: 0,
					availableCredits: 0,
					createdAt: now,
				},
			},
			{ upsert: true },
		);

		return { ok: true as const };
	});

export const searchCommunityFn = createServerFn({ method: "POST" })
	.validator(searchCommunityInputSchema)
	.handler(async ({ data }) => {
		const query = data.query.trim();
		const database = await connectToDatabase();
		const { userId } = await auth();

		const profileFilter = query
			? {
					discoverable: { $ne: false },
					$or: [
						{ displayName: { $regex: escapeRegex(query), $options: "i" } },
						{ bio: { $regex: escapeRegex(query), $options: "i" } },
						{ skills: { $regex: escapeRegex(query), $options: "i" } },
						{ interests: { $regex: escapeRegex(query), $options: "i" } },
						{ campusArea: { $regex: escapeRegex(query), $options: "i" } },
					],
				}
			: { discoverable: { $ne: false } };

		const offerText = query
			? {
					$or: [
						{ title: { $regex: escapeRegex(query), $options: "i" } },
						{ description: { $regex: escapeRegex(query), $options: "i" } },
						{ skills: { $regex: escapeRegex(query), $options: "i" } },
						{ displayName: { $regex: escapeRegex(query), $options: "i" } },
					],
				}
			: {};
		const requestText = query
			? {
					$or: [
						{ title: { $regex: escapeRegex(query), $options: "i" } },
						{ description: { $regex: escapeRegex(query), $options: "i" } },
						{ skillsNeeded: { $regex: escapeRegex(query), $options: "i" } },
						{ displayName: { $regex: escapeRegex(query), $options: "i" } },
					],
				}
			: {};

		const [profiles, offers, requests, clerkUsers] = await Promise.all([
			database.collection("profiles").find(profileFilter).limit(24).toArray(),
			database
				.collection("offers")
				.find({
					status: { $in: ["active", "matched"] },
					...offerText,
				})
				.sort({ createdAt: -1 })
				.limit(query ? 12 : 24)
				.toArray(),
			database
				.collection("helpRequests")
				.find({
					status: { $in: ["open", "matched", "active"] },
					...requestText,
				})
				.sort({ createdAt: -1 })
				.limit(query ? 12 : 24)
				.toArray(),
			query
				? clerkClient()
						.users.getUserList({ query, limit: 20 })
						.catch(() => ({ data: [] }))
				: Promise.resolve({ data: [] }),
		]);

		const peopleById = new Map<string, UserProfile>();
		const savedProfileIds = new Set(
			profiles.map((profile) => String(profile.clerkUserId)),
		);

		for (const profile of profiles) {
			const id = String(profile.clerkUserId);
			peopleById.set(id, mapProfile(profile, id, "Community member"));
		}

		for (const item of [...offers, ...requests]) {
			const id = String(item.userId);
			if (!id) continue;
			const current =
				peopleById.get(id) ??
				emptyProfile(
					id,
					typeof item.displayName === "string"
						? item.displayName
						: "Community member",
				);
			const extraSkills = asStringArray(item.skills ?? item.skillsNeeded);
			peopleById.set(id, {
				...current,
				displayName:
					!savedProfileIds.has(id) &&
					typeof item.displayName === "string" &&
					item.displayName.trim()
						? item.displayName
						: current.displayName,
				skills: unique([...current.skills, ...extraSkills]),
			});
		}

		for (const user of clerkUsers.data) {
			if (peopleById.has(user.id)) continue;
			peopleById.set(
				user.id,
				mapProfile(
					null,
					user.id,
					user.firstName || user.username || "Community member",
				),
			);
		}

		const extraIds = [...peopleById.keys()].filter(
			(id) => !profiles.some((profile) => String(profile.clerkUserId) === id),
		);

		if (extraIds.length > 0) {
			const extras = await database
				.collection("profiles")
				.find({ clerkUserId: { $in: extraIds } })
				.toArray();

			for (const extra of extras) {
				const id = String(extra.clerkUserId);
				const current = peopleById.get(id);
				peopleById.set(
					id,
					mapProfile(extra, id, current?.displayName ?? "Community member"),
				);
			}
		}

		for (const [id, person] of peopleById) {
			if (!person.discoverable && person.clerkUserId !== userId) {
				peopleById.delete(id);
			}
		}

		const unnamedIds = [...peopleById.values()]
			.filter((person) => person.displayName === "Community member")
			.map((person) => person.clerkUserId);

		if (unnamedIds.length > 0) {
			try {
				const named = await clerkClient().users.getUserList({
					userId: unnamedIds,
					limit: 100,
				});
				for (const user of named.data) {
					const current = peopleById.get(user.id);
					if (!current) continue;
					peopleById.set(user.id, {
						...current,
						displayName: user.firstName || user.username || current.displayName,
					});
				}
			} catch {
				// Keep the fallback names if Clerk is unavailable.
			}
		}

		const posts: Array<
			Pick<
				CommunityPost,
				| "id"
				| "type"
				| "title"
				| "description"
				| "skills"
				| "minutes"
				| "availability"
				| "status"
				| "createdAt"
				| "userId"
				| "displayName"
			>
		> = [
			...offers.map((offer) => ({
				id: offer._id.toString(),
				type: "offer" as const,
				title: String(offer.title),
				description: String(offer.description),
				skills: asStringArray(offer.skills),
				minutes:
					typeof offer.availableMinutes === "number"
						? offer.availableMinutes
						: null,
				availability:
					typeof offer.availability === "string" ? offer.availability : null,
				status:
					offer.status === "matched" || offer.status === "completed"
						? offer.status
						: "active",
				createdAt:
					offer.createdAt instanceof Date
						? offer.createdAt.toISOString()
						: new Date(String(offer.createdAt)).toISOString(),
				userId: String(offer.userId),
				displayName:
					typeof offer.displayName === "string"
						? offer.displayName
						: "Community member",
			})),
			...requests.map((request) => ({
				id: request._id.toString(),
				type: "request" as const,
				title: String(request.title),
				description: String(request.description),
				skills: asStringArray(request.skillsNeeded),
				minutes:
					typeof request.estimatedMinutes === "number"
						? request.estimatedMinutes
						: null,
				availability:
					typeof request.availability === "string"
						? request.availability
						: null,
				status:
					request.status === "matched" ||
					request.status === "completed" ||
					request.status === "active"
						? request.status
						: "open",
				createdAt:
					request.createdAt instanceof Date
						? request.createdAt.toISOString()
						: new Date(String(request.createdAt)).toISOString(),
				userId: String(request.userId),
				displayName:
					typeof request.displayName === "string"
						? request.displayName
						: "Community member",
			})),
		];

		if (query && peopleById.size > 0) {
			const authorIds = [...peopleById.keys()];
			const [authorOffers, authorRequests] = await Promise.all([
				database
					.collection("offers")
					.find({
						userId: { $in: authorIds },
						status: { $in: ["active", "matched"] },
					})
					.sort({ createdAt: -1 })
					.limit(12)
					.toArray(),
				database
					.collection("helpRequests")
					.find({
						userId: { $in: authorIds },
						status: { $in: ["open", "matched", "active"] },
					})
					.sort({ createdAt: -1 })
					.limit(12)
					.toArray(),
			]);

			const extra = [
				...authorOffers.map((offer) => ({
					id: offer._id.toString(),
					type: "offer" as const,
					title: String(offer.title),
					description: String(offer.description),
					skills: asStringArray(offer.skills),
					minutes:
						typeof offer.availableMinutes === "number"
							? offer.availableMinutes
							: null,
					availability:
						typeof offer.availability === "string" ? offer.availability : null,
					status:
						offer.status === "matched" || offer.status === "completed"
							? offer.status
							: ("active" as const),
					createdAt:
						offer.createdAt instanceof Date
							? offer.createdAt.toISOString()
							: new Date(String(offer.createdAt)).toISOString(),
					userId: String(offer.userId),
					displayName:
						peopleById.get(String(offer.userId))?.displayName ??
						(typeof offer.displayName === "string"
							? offer.displayName
							: "Community member"),
				})),
				...authorRequests.map((request) => ({
					id: request._id.toString(),
					type: "request" as const,
					title: String(request.title),
					description: String(request.description),
					skills: asStringArray(request.skillsNeeded),
					minutes:
						typeof request.estimatedMinutes === "number"
							? request.estimatedMinutes
							: null,
					availability:
						typeof request.availability === "string"
							? request.availability
							: null,
					status:
						request.status === "matched" ||
						request.status === "completed" ||
						request.status === "active"
							? request.status
							: ("open" as const),
					createdAt:
						request.createdAt instanceof Date
							? request.createdAt.toISOString()
							: new Date(String(request.createdAt)).toISOString(),
					userId: String(request.userId),
					displayName:
						peopleById.get(String(request.userId))?.displayName ??
						(typeof request.displayName === "string"
							? request.displayName
							: "Community member"),
				})),
			];

			const seen = new Set(posts.map((post) => post.id));
			for (const post of extra) {
				if (seen.has(post.id)) continue;
				seen.add(post.id);
				posts.push(post);
			}
		}

		return {
			query,
			people: [...peopleById.values()].slice(0, 24),
			posts: query ? posts : [],
		};
	});

export const searchCommunityPaginatedFn = createServerFn({ method: "POST" })
	.validator(searchCommunityInputSchema)
	.handler(async ({ data }) => {
		const query = data.query.trim();
		const database = await connectToDatabase();
		const profileFilter = query
			? {
					discoverable: { $ne: false },
					$or: [
						{ displayName: { $regex: escapeRegex(query), $options: "i" } },
						{ bio: { $regex: escapeRegex(query), $options: "i" } },
						{ skills: { $regex: escapeRegex(query), $options: "i" } },
						{ interests: { $regex: escapeRegex(query), $options: "i" } },
						{ campusArea: { $regex: escapeRegex(query), $options: "i" } },
					],
				}
			: { discoverable: { $ne: false } };
		const offerText = query
			? {
					$or: [
						{ title: { $regex: escapeRegex(query), $options: "i" } },
						{ description: { $regex: escapeRegex(query), $options: "i" } },
						{ skills: { $regex: escapeRegex(query), $options: "i" } },
						{ displayName: { $regex: escapeRegex(query), $options: "i" } },
					],
				}
			: {};
		const requestText = query
			? {
					$or: [
						{ title: { $regex: escapeRegex(query), $options: "i" } },
						{ description: { $regex: escapeRegex(query), $options: "i" } },
						{ skillsNeeded: { $regex: escapeRegex(query), $options: "i" } },
						{ displayName: { $regex: escapeRegex(query), $options: "i" } },
					],
				}
			: {};
		const offerFilter = {
			status: { $in: ["active", "matched"] },
			archivedAt: { $exists: false },
			...offerText,
		};
		const requestFilter = {
			status: { $in: ["open", "matched", "active"] },
			archivedAt: { $exists: false },
			...requestText,
		};
		const [peopleCount, offerCount, requestCount] = await Promise.all([
			database.collection("profiles").countDocuments(profileFilter),
			query
				? database.collection("offers").countDocuments(offerFilter)
				: Promise.resolve(0),
			query
				? database.collection("helpRequests").countDocuments(requestFilter)
				: Promise.resolve(0),
		]);
		const peoplePagination = paginationMeta({
			page: data.peoplePage,
			pageSize: data.pageSize,
			totalItems: peopleCount,
		});
		const postsPagination = paginationMeta({
			page: data.postsPage,
			pageSize: data.pageSize,
			totalItems: offerCount + requestCount,
		});
		const profiles = await database
			.collection("profiles")
			.find(profileFilter)
			.sort({ displayName: 1, _id: 1 })
			.skip((peoplePagination.page - 1) * peoplePagination.pageSize)
			.limit(peoplePagination.pageSize)
			.toArray();
		const people = profiles.map((profile) =>
			mapProfile(
				profile,
				String(profile.clerkUserId),
				typeof profile.displayName === "string"
					? profile.displayName
					: "Community member",
			),
		);
		const documents = query
			? await database
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
					.toArray()
			: [];
		const posts = documents.map((document) => {
			const type: "offer" | "request" =
				document.__postType === "offer" ? "offer" : "request";
			const rawMinutes =
				type === "offer"
					? document.availableMinutes
					: document.estimatedMinutes;
			return {
				id: document._id.toString(),
				type,
				title: String(document.title),
				description: String(document.description),
				skills: asStringArray(
					type === "offer" ? document.skills : document.skillsNeeded,
				),
				minutes: typeof rawMinutes === "number" ? rawMinutes : null,
				availability:
					typeof document.availability === "string"
						? document.availability
						: null,
				status:
					document.status === "matched"
						? ("matched" as const)
						: type === "offer"
							? ("active" as const)
							: ("open" as const),
				createdAt:
					document.createdAt instanceof Date
						? document.createdAt.toISOString()
						: new Date(String(document.createdAt)).toISOString(),
				userId: String(document.userId),
				displayName:
					typeof document.displayName === "string"
						? document.displayName
						: "Community member",
			};
		});

		return { query, people, posts, peoplePagination, postsPagination };
	});

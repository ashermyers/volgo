import { auth, clerkClient } from "@clerk/tanstack-react-start/server";
import { chat } from "@tanstack/ai";
import { createGeminiChat } from "@tanstack/ai-gemini";
import { createServerFn } from "@tanstack/react-start";

import {
	type AnalyzeIntentResult,
	analyzeIntentInputSchema,
	analyzeIntentResultSchema,
	capturedIntentSchema,
	deleteIntentInputSchema,
	type IntentListItem,
	publishIntentInputSchema,
} from "#/features/intents/schema";
import { localAnalyzeIntent } from "#/lib/clarify";
import { connectToDatabase, parseObjectId } from "#/lib/db";
import { mergeSkillsIntoProfile } from "#/server/profiles";

const INTENT_SYSTEM_PROMPT = `You help people in VOLGO, a community time-banking service, turn a note into a useful post.

Decide:
- "offer" when they are primarily volunteering time or skill.
- "request" when they are primarily asking for help.

If the note is too vague to match well, return status "clarify". Vague means missing the topic/skill, missing whether they need help or can help, or missing a useful constraint such as time, duration, or what specifically is broken/needed. Ask 1-3 short, concrete questions. Do not ask for contact details. Keep note to one or two warm sentences. Leave intent null when clarifying.

If the note is already specific enough to post, or the user already answered your questions, return status "ready" with a complete intent. Write a concise human title and a faithful first-person description. Skills are short tags such as "Java", "Moving", "Linux", or "Calculus" (at most six). Set minutes only when stated or strongly implied; otherwise null. Preserve availability in plain language, or null. Never invent dates, credentials, or contact details. questions should be [] when ready.

If the user asks to post anyway, return ready with the best intent you can from what they already said.`;

function getGeminiAdapter() {
	const apiKey = process.env.GEMINI_API_KEY;

	if (!apiKey) {
		throw new Error("GEMINI_API_KEY is not configured");
	}

	return createGeminiChat("gemini-3.1-pro-preview", apiKey);
}

async function requireUserId() {
	const { isAuthenticated, userId } = await auth();

	if (!isAuthenticated || !userId) {
		throw new Error("You must be signed in to continue");
	}

	return userId;
}

function normalizeResult(result: AnalyzeIntentResult): AnalyzeIntentResult {
	if (result.status === "ready") {
		const intent = capturedIntentSchema.parse(result.intent);
		return { ...result, intent, questions: [] };
	}

	if (result.questions.length === 0 && result.intent) {
		const intent = capturedIntentSchema.parse(result.intent);
		return { ...result, status: "ready", intent, questions: [] };
	}

	return { ...result, intent: null };
}

export const analyzeIntentFn = createServerFn({ method: "POST" })
	.validator(analyzeIntentInputSchema)
	.handler(async ({ data }) => {
		const forceNote = data.force
			? "The user chose to post with the details they already gave. Return status ready."
			: "";

		try {
			const result = await chat({
				adapter: getGeminiAdapter(),
				messages: data.messages.map((message) => ({
					role: message.role,
					content: message.content,
				})),
				systemPrompts: [INTENT_SYSTEM_PROMPT, forceNote].filter(Boolean),
				outputSchema: analyzeIntentResultSchema,
			});

			return normalizeResult(result);
		} catch {
			return localAnalyzeIntent(data.messages, data.force ?? false);
		}
	});

export const publishIntentFn = createServerFn({ method: "POST" })
	.validator(publishIntentInputSchema)
	.handler(async ({ data }) => {
		const userId = await requireUserId();
		const clerkUser = await clerkClient().users.getUser(userId);
		const displayName =
			clerkUser.firstName || clerkUser.username || "Community member";
		const database = await connectToDatabase();
		const now = new Date();

		await mergeSkillsIntoProfile({
			userId,
			displayName,
			skills: data.intent.skills,
			availability: data.intent.availability,
		});

		if (data.intent.type === "offer") {
			const result = await database.collection("offers").insertOne({
				userId,
				displayName,
				title: data.intent.title,
				description: data.intent.description,
				skills: data.intent.skills,
				availableMinutes: data.intent.minutes,
				availability: data.intent.availability,
				status: "active",
				createdAt: now,
				updatedAt: now,
			});

			return { id: result.insertedId.toString(), type: "offer" as const };
		}

		const result = await database.collection("helpRequests").insertOne({
			userId,
			displayName,
			title: data.intent.title,
			description: data.intent.description,
			skillsNeeded: data.intent.skills,
			estimatedMinutes: data.intent.minutes,
			availability: data.intent.availability,
			status: "open",
			createdAt: now,
			updatedAt: now,
		});

		return { id: result.insertedId.toString(), type: "request" as const };
	});

export const deleteIntentFn = createServerFn({ method: "POST" })
	.validator(deleteIntentInputSchema)
	.handler(async ({ data }) => {
		const userId = await requireUserId();
		const postId = await parseObjectId(data.postId);

		if (!postId) {
			throw new Error("That post could not be found");
		}

		const database = await connectToDatabase();
		const collectionName =
			data.postType === "offer" ? "offers" : "helpRequests";
		const result = await database.collection(collectionName).deleteOne({
			_id: postId,
			userId,
		});

		if (result.deletedCount === 0) {
			throw new Error("That post could not be found");
		}

		await database.collection("matches").deleteMany({ postId: data.postId });

		return { ok: true as const };
	});

export const getMyIntentsFn = createServerFn({ method: "GET" }).handler(
	async () => {
		const { isAuthenticated, userId } = await auth();

		if (!isAuthenticated || !userId) {
			return { isAuthenticated: false, items: [] as IntentListItem[] };
		}

		const database = await connectToDatabase();
		const [offers, requests] = await Promise.all([
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
		]);

		const items: IntentListItem[] = [
			...offers.map((offer) => ({
				id: offer._id.toString(),
				type: "offer" as const,
				title: String(offer.title),
				description: String(offer.description),
				skills: Array.isArray(offer.skills)
					? offer.skills.filter(
							(skill): skill is string => typeof skill === "string",
						)
					: [],
				minutes:
					typeof offer.availableMinutes === "number"
						? offer.availableMinutes
						: null,
				availability:
					typeof offer.availability === "string" ? offer.availability : null,
				confidence: 1,
				status:
					offer.status === "completed" || offer.status === "matched"
						? offer.status
						: "active",
				createdAt:
					offer.createdAt instanceof Date
						? offer.createdAt.toISOString()
						: new Date(offer.createdAt).toISOString(),
			})),
			...requests.map((request) => ({
				id: request._id.toString(),
				type: "request" as const,
				title: String(request.title),
				description: String(request.description),
				skills: Array.isArray(request.skillsNeeded)
					? request.skillsNeeded.filter(
							(skill): skill is string => typeof skill === "string",
						)
					: [],
				minutes:
					typeof request.estimatedMinutes === "number"
						? request.estimatedMinutes
						: null,
				availability:
					typeof request.availability === "string"
						? request.availability
						: null,
				confidence: 1,
				status:
					request.status === "matched" ||
					request.status === "completed" ||
					request.status === "active"
						? request.status
						: "open",
				createdAt:
					request.createdAt instanceof Date
						? request.createdAt.toISOString()
						: new Date(request.createdAt).toISOString(),
			})),
		];

		items.sort((left, right) => right.createdAt.localeCompare(left.createdAt));

		return { isAuthenticated: true, items };
	},
);

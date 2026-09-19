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
	publishIntentInputSchema,
} from "#/features/intents/schema";
import { localAnalyzeIntent } from "#/lib/clarify";
import { connectToDatabase, parseObjectId } from "#/lib/db";
import { archiveOwnedIntent, restoreOwnedIntent } from "#/lib/intent-archive";
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

export const archiveIntentFn = createServerFn({ method: "POST" })
	.validator(deleteIntentInputSchema)
	.handler(async ({ data }) => {
		const userId = await requireUserId();
		const postId = await parseObjectId(data.postId);

		if (!postId) {
			throw new Error("That post could not be found");
		}

		const database = await connectToDatabase();
		return archiveOwnedIntent({
			database,
			postId,
			postType: data.postType,
			userId,
		});
	});

export const restoreIntentFn = createServerFn({ method: "POST" })
	.validator(deleteIntentInputSchema)
	.handler(async ({ data }) => {
		const userId = await requireUserId();
		const postId = await parseObjectId(data.postId);

		if (!postId) {
			throw new Error("That post could not be found");
		}

		const database = await connectToDatabase();
		return restoreOwnedIntent({
			database,
			postId,
			postType: data.postType,
			userId,
		});
	});

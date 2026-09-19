import { auth } from "@clerk/tanstack-react-start/server";
import { chat } from "@tanstack/ai";
import { createGeminiChat } from "@tanstack/ai-gemini";
import { createServerFn } from "@tanstack/react-start";

import {
	analyzeIntentInputSchema,
	capturedIntentSchema,
	type IntentListItem,
	publishIntentInputSchema,
} from "#/features/intents/schema";
import { connectToDatabase } from "#/lib/db";

const INTENT_SYSTEM_PROMPT = `You extract a single actionable post for VOLGO, a community time-banking service.

Classify the user's message as:
- "offer" when they are primarily volunteering their own time or skill.
- "request" when they are primarily asking the community for help.

Write a concise, human title and a faithful first-person description. Keep concrete details from the message. Skills should be short service tags such as "Java", "Moving", "Linux", or "Calculus". Return at most six skills. Set minutes only when the user states or strongly implies a duration; otherwise use null. Preserve their availability in plain language, or use null. Confidence is your confidence in the offer/request classification from 0 to 1. Never invent contact details, credentials, dates, or availability.`;

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

export const analyzeIntentFn = createServerFn({ method: "POST" })
	.validator(analyzeIntentInputSchema)
	.handler(async ({ data }) => {
		await requireUserId();

		return chat({
			adapter: getGeminiAdapter(),
			messages: [{ role: "user", content: data.prompt }],
			systemPrompts: [INTENT_SYSTEM_PROMPT],
			outputSchema: capturedIntentSchema,
		});
	});

export const publishIntentFn = createServerFn({ method: "POST" })
	.validator(publishIntentInputSchema)
	.handler(async ({ data }) => {
		const userId = await requireUserId();
		const database = await connectToDatabase();
		const now = new Date();

		if (data.intent.type === "offer") {
			const result = await database.collection("offers").insertOne({
				userId,
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

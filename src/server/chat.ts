import { auth } from "@clerk/tanstack-react-start/server";
import { chat, toServerSentEventsResponse, type UIMessage } from "@tanstack/ai";
import { createGeminiChat } from "@tanstack/ai-gemini";
import { createServerFn } from "@tanstack/react-start";

const VOLGO_SYSTEM_PROMPT = `You are VOLGO's community guide. VOLGO helps people exchange time and skills around their community. Respond warmly and concisely in one or two sentences. Acknowledge the user's specific need or offer, then tell them you have prepared the details for review. Do not sound like a chatbot, ask follow-up questions, use markdown headings, or invent details.`;

function getGeminiAdapter() {
	const apiKey = process.env.GEMINI_API_KEY;

	if (!apiKey) {
		throw new Error("GEMINI_API_KEY is not configured");
	}

	return createGeminiChat("gemini-3.1-pro-preview", apiKey);
}

export const chatFn = createServerFn({ method: "POST" })
	.validator((data: { messages: UIMessage[] }) => data)
	.handler(async ({ data }) => {
		const { isAuthenticated, userId } = await auth();

		if (!isAuthenticated || !userId) {
			return new Response("Unauthorized", {
				status: 401,
			});
		}

		const stream = chat({
			adapter: getGeminiAdapter(),
			messages: data.messages,
			systemPrompts: [VOLGO_SYSTEM_PROMPT],
		});

		return toServerSentEventsResponse(stream);
	});

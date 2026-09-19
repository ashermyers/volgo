import type {
	AnalyzeIntentResult,
	CapturedIntent,
	ConversationMessage,
} from "#/features/intents/schema";

function userText(messages: ConversationMessage[]) {
	return messages
		.filter((message) => message.role === "user")
		.map((message) => message.content.trim())
		.filter(Boolean)
		.join(" ");
}

function looksSpecific(text: string) {
	const hasSkill =
		/\b(java|linux|python|calculus|calc|tutoring|tutor|moving|move|code|desk|math|ubuntu|cs|homework)\b/i.test(
			text,
		);
	const hasTime =
		/\b(\d+\s*(hour|hr|minute|min)s?|saturday|sunday|afternoon|evening|morning|tonight|tomorrow|week)\b/i.test(
			text,
		);
	return text.split(/\s+/).length >= 10 && hasSkill && hasTime;
}

export function localAnalyzeIntent(
	messages: ConversationMessage[],
	force = false,
): AnalyzeIntentResult {
	const text = userText(messages);
	const offering =
		/\b(can help|i have|offer|give|free hour|want to help)\b/i.test(text);
	const type: CapturedIntent["type"] = offering ? "offer" : "request";

	if (!force && !looksSpecific(text)) {
		return {
			status: "clarify",
			note: offering
				? "We can turn that into an offer. A couple of details will help someone find you."
				: "We can turn that into a request. A couple of details will help the right person step in.",
			questions: offering
				? [
						"What skill or kind of help are you offering?",
						"About how much time do you have, and when?",
					]
				: [
						"What do you need help with, specifically?",
						"When do you need this, and about how long might it take?",
					],
			intent: null,
		};
	}

	const skills = text
		.split(/[^a-zA-Z+#]+/)
		.filter((word) => word.length > 2)
		.slice(0, 4);

	return {
		status: "ready",
		note: "Here’s a first draft from what you shared.",
		questions: [],
		intent: {
			type,
			title: text.slice(0, 68) || (offering ? "I can help" : "I need help"),
			description:
				text.length >= 8 ? text : `${text} I can help around campus.`,
			skills:
				skills.length > 0 ? skills : [offering ? "General Help" : "Support"],
			minutes: null,
			availability: null,
			confidence: 0.4,
		},
	};
}

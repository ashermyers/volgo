import { z } from "zod";

export const intentTypeSchema = z.enum(["offer", "request"]);

export const capturedIntentSchema = z.object({
	type: intentTypeSchema,
	title: z.string().trim().min(3).max(72),
	description: z.string().trim().min(8).max(600),
	skills: z.array(z.string().trim().min(1).max(40)).max(6),
	minutes: z.number().int().min(1).max(480).nullable(),
	availability: z.string().trim().min(2).max(120).nullable(),
	confidence: z.number().min(0).max(1),
});

export type CapturedIntent = z.infer<typeof capturedIntentSchema>;

export const conversationMessageSchema = z.object({
	role: z.enum(["user", "assistant"]),
	content: z.string().trim().min(1).max(800),
});

export type ConversationMessage = z.infer<typeof conversationMessageSchema>;

export const analyzeIntentInputSchema = z.object({
	messages: z.array(conversationMessageSchema).min(1).max(12),
	force: z.boolean().optional(),
});

export const analyzeIntentResultSchema = z.object({
	status: z.enum(["clarify", "ready"]),
	note: z.string().trim().min(8).max(400),
	questions: z.array(z.string().trim().min(4).max(140)).max(3),
	intent: capturedIntentSchema.nullable(),
});

export type AnalyzeIntentResult = z.infer<typeof analyzeIntentResultSchema>;

export const publishIntentInputSchema = z.object({
	intent: capturedIntentSchema,
});

export const deleteIntentInputSchema = z.object({
	postId: z.string().min(1),
	postType: intentTypeSchema,
});

export type IntentListItem = CapturedIntent & {
	id: string;
	status: "active" | "open" | "matched" | "completed" | "archived";
	createdAt: string;
};

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

export const analyzeIntentInputSchema = z.object({
	prompt: z.string().trim().min(8).max(600),
});

export const publishIntentInputSchema = z.object({
	intent: capturedIntentSchema,
});

export type IntentListItem = CapturedIntent & {
	id: string;
	status: "active" | "open" | "matched" | "completed";
	createdAt: string;
};

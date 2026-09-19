import { z } from "zod";

import { intentTypeSchema } from "#/features/intents/schema";

export const communityStatusSchema = z.enum([
	"active",
	"open",
	"matched",
	"completed",
]);

export const communityPostSchema = z.object({
	id: z.string(),
	type: intentTypeSchema,
	title: z.string(),
	description: z.string(),
	skills: z.array(z.string()),
	minutes: z.number().nullable(),
	availability: z.string().nullable(),
	status: communityStatusSchema,
	createdAt: z.string(),
	userId: z.string(),
	displayName: z.string(),
	matchScore: z.number().nullable(),
	matchExplanation: z.string().nullable(),
	expressedInterest: z.boolean(),
});

export type CommunityPost = z.infer<typeof communityPostSchema>;

export const expressInterestInputSchema = z.object({
	postId: z.string().min(1),
	postType: intentTypeSchema,
});

export const matchStatusSchema = z.enum(["pending", "accepted", "completed"]);

export const matchActionInputSchema = z.object({
	matchId: z.string().min(1),
});

export const incomingInterestSchema = z.object({
	id: z.string(),
	postId: z.string(),
	postType: intentTypeSchema,
	postTitle: z.string(),
	fromDisplayName: z.string(),
	score: z.number(),
	explanation: z.string().nullable(),
	status: matchStatusSchema,
	createdAt: z.string(),
});

export type IncomingInterest = z.infer<typeof incomingInterestSchema>;

export const boardItemSchema = communityPostSchema
	.omit({
		matchScore: true,
		matchExplanation: true,
		expressedInterest: true,
		userId: true,
		displayName: true,
	})
	.extend({
		incomingCount: z.number().int().nonnegative(),
		partnerName: z.string().nullable(),
		acceptedMatchId: z.string().nullable(),
	});

export type BoardItem = z.infer<typeof boardItemSchema>;

export const impactSnapshotSchema = z.object({
	isAuthenticated: z.boolean(),
	posts: z.number().int().nonnegative(),
	peopleReached: z.number().int().nonnegative(),
	minutesPledged: z.number().int().nonnegative(),
	skills: z.array(z.string()),
	recent: z.array(
		communityPostSchema.omit({
			matchScore: true,
			matchExplanation: true,
			expressedInterest: true,
			userId: true,
			displayName: true,
		}),
	),
});

export type ImpactSnapshot = z.infer<typeof impactSnapshotSchema>;

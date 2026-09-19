import { z } from "zod";

import { intentTypeSchema } from "#/features/intents/schema";
import { paginationInputSchema } from "#/features/pagination/schema";
import { privateContactSchema } from "#/features/profiles/schema";

export const communityStatusSchema = z.enum([
	"active",
	"open",
	"matched",
	"completed",
	"archived",
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

export const discoverFeedInputSchema = paginationInputSchema.extend({
	filter: z.enum(["for-you", "request", "offer", "all"]).default("all"),
});

export const boardPaginationInputSchema = z.object({
	postFilter: z.enum(["all", "request", "offer", "archived"]).default("all"),
	postsPage: z.number().int().min(1).max(10_000).default(1),
	incomingPage: z.number().int().min(1).max(10_000).default(1),
	connectionsPage: z.number().int().min(1).max(10_000).default(1),
	pageSize: paginationInputSchema.shape.pageSize.default(6),
});

export const expressInterestInputSchema = z.object({
	postId: z.string().min(1),
	postType: intentTypeSchema,
});

export const matchStatusSchema = z.enum([
	"pending",
	"accepted",
	"awaiting_confirmation",
	"completed",
]);

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

export const solanaAuditSchema = z.object({
	status: z.enum([
		"pending",
		"submitting",
		"submitted",
		"confirmed",
		"failed",
		"unconfigured",
	]),
	network: z.string(),
	receiptId: z.string(),
	receiptHash: z.string(),
	authority: z.string().nullable(),
	signature: z.string().nullable(),
	slot: z.number().int().nonnegative().nullable(),
	explorerUrl: z.string().url().nullable(),
});

export type SolanaAudit = z.infer<typeof solanaAuditSchema>;

export const auditLookupInputSchema = z.object({
	receipt: z.string().trim().max(128).optional(),
});

export const activeConnectionSchema = z.object({
	id: z.string(),
	postTitle: z.string(),
	postType: intentTypeSchema,
	partnerName: z.string(),
	partnerContact: privateContactSchema,
	minutes: z.number().int().positive(),
	status: matchStatusSchema.exclude(["pending"]),
	youConfirmed: z.boolean(),
	partnerConfirmed: z.boolean(),
	role: z.enum(["provider", "recipient"]),
	audit: solanaAuditSchema.nullable(),
});

export type ActiveConnection = z.infer<typeof activeConnectionSchema>;

export const impactSnapshotSchema = z.object({
	isAuthenticated: z.boolean(),
	posts: z.number().int().nonnegative(),
	peopleReached: z.number().int().nonnegative(),
	minutesPledged: z.number().int().nonnegative(),
	verifiedMinutes: z.number().int().nonnegative(),
	auditedMinutes: z.number().int().nonnegative(),
	availableCredits: z.number().int().nonnegative(),
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

export const leaderboardEntrySchema = z.object({
	rank: z.number().int().positive(),
	userId: z.string(),
	displayName: z.string(),
	verifiedMinutes: z.number().int().positive(),
	exchanges: z.number().int().positive(),
	skills: z.array(z.string()),
});

export type LeaderboardEntry = z.infer<typeof leaderboardEntrySchema>;

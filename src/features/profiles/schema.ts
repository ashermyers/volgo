import { z } from "zod";

export const profileSchema = z.object({
	clerkUserId: z.string(),
	displayName: z.string(),
	bio: z.string(),
	skills: z.array(z.string()),
	interests: z.array(z.string()),
	availability: z.string(),
	campusArea: z.string(),
	discoverable: z.boolean(),
	notifyOnInterest: z.boolean(),
	lifetimeMinutes: z.number().int().nonnegative(),
	availableCredits: z.number().int().nonnegative(),
});

export type UserProfile = z.infer<typeof profileSchema>;

export const updateProfileInputSchema = z.object({
	displayName: z.string().trim().min(2).max(48),
	bio: z.string().trim().max(400),
	skills: z.array(z.string().trim().min(1).max(40)).max(12),
	interests: z.array(z.string().trim().min(1).max(40)).max(12),
	availability: z.string().trim().max(120),
	campusArea: z.string().trim().max(80),
	discoverable: z.boolean(),
	notifyOnInterest: z.boolean(),
});

export type UpdateProfileInput = z.infer<typeof updateProfileInputSchema>;

export const searchCommunityInputSchema = z.object({
	query: z.string().trim().max(80),
});

export const publicProfileSchema = profileSchema.extend({
	isSelf: z.boolean(),
	recentTitles: z.array(z.string()),
});

export type PublicProfile = z.infer<typeof publicProfileSchema>;

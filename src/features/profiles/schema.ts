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
	phone: z.string().trim().max(32).optional(),
	email: z
		.union([z.literal(""), z.string().trim().email().max(120)])
		.optional(),
});

export type UpdateProfileInput = z.infer<typeof updateProfileInputSchema>;

export const privateContactSchema = z.object({
	phone: z.string().nullable(),
	email: z.string().nullable(),
});

export type PrivateContact = z.infer<typeof privateContactSchema>;

export const onboardingInputSchema = updateProfileInputSchema
	.pick({
		displayName: true,
		bio: true,
		skills: true,
		interests: true,
		availability: true,
		campusArea: true,
	})
	.extend({
		skills: z.array(z.string().trim().min(1).max(40)).min(1).max(12),
		phone: z.string().trim().max(32),
		email: z.union([z.literal(""), z.string().trim().email().max(120)]),
	})
	.refine((data) => data.phone.length > 0 || data.email.length > 0, {
		message: "Add a phone number or email so a match can contact you.",
	});

export type OnboardingInput = z.infer<typeof onboardingInputSchema>;

export const resumeUploadInputSchema = z.object({
	name: z.string().trim().min(1).max(160),
	mimeType: z.enum(["application/pdf", "text/plain"]),
	base64: z.string().min(1).max(7_500_000),
});

export const resumeSummarySchema = z.object({
	bio: z.string().trim().min(1).max(400),
	skills: z.array(z.string().trim().min(1).max(40)).min(1).max(12),
	interests: z.array(z.string().trim().min(1).max(40)).max(12),
});

export type ResumeSummary = z.infer<typeof resumeSummarySchema>;

export const searchCommunityInputSchema = z.object({
	query: z.string().trim().max(80),
});

export const publicProfileSchema = profileSchema.extend({
	isSelf: z.boolean(),
	recentTitles: z.array(z.string()),
});

export type PublicProfile = z.infer<typeof publicProfileSchema>;

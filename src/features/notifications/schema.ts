import { z } from "zod";

export const notificationTypeSchema = z.enum([
	"interest_received",
	"match_accepted",
	"hours_confirmed",
	"exchange_completed",
	"request_fulfilled",
	"thank_you_received",
	"post_published",
	"post_updated",
	"post_withdrawn",
	"interest_withdrawn",
]);

export type NotificationType = z.infer<typeof notificationTypeSchema>;

export const notificationItemSchema = z.object({
	id: z.string(),
	type: notificationTypeSchema,
	title: z.string(),
	body: z.string(),
	href: z.string(),
	entityId: z.string(),
	actorUserId: z.string().nullable(),
	readAt: z.string().nullable(),
	createdAt: z.string(),
});

export type NotificationItem = z.infer<typeof notificationItemSchema>;

export const notificationInboxInputSchema = z.object({
	limit: z.number().int().min(1).max(40).default(20),
});

export const markNotificationsReadInputSchema = z.object({
	ids: z.array(z.string().min(1)).max(40).default([]),
	all: z.boolean().default(false),
});

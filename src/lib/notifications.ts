import type { Db } from "mongodb";

import type {
	NotificationItem,
	NotificationType,
} from "#/features/notifications/schema";

export type NotificationWrite = {
	userId: string;
	actorUserId?: string | null;
	type: NotificationType;
	title: string;
	body: string;
	href: string;
	entityId: string;
};

export function mapNotification(document: {
	_id: { toString(): string };
	type?: unknown;
	title?: unknown;
	body?: unknown;
	href?: unknown;
	entityId?: unknown;
	actorUserId?: unknown;
	readAt?: unknown;
	createdAt?: unknown;
}): NotificationItem {
	return {
		id: document._id.toString(),
		type:
			document.type === "interest_received" ||
			document.type === "match_accepted" ||
			document.type === "hours_confirmed" ||
			document.type === "exchange_completed" ||
			document.type === "post_published" ||
			document.type === "post_updated" ||
			document.type === "post_withdrawn" ||
			document.type === "interest_withdrawn"
				? document.type
				: "interest_received",
		title: typeof document.title === "string" ? document.title : "Update",
		body: typeof document.body === "string" ? document.body : "",
		href: typeof document.href === "string" ? document.href : "/requests",
		entityId: typeof document.entityId === "string" ? document.entityId : "",
		actorUserId:
			typeof document.actorUserId === "string" ? document.actorUserId : null,
		readAt:
			document.readAt instanceof Date
				? document.readAt.toISOString()
				: typeof document.readAt === "string"
					? document.readAt
					: null,
		createdAt:
			document.createdAt instanceof Date
				? document.createdAt.toISOString()
				: new Date(String(document.createdAt ?? Date.now())).toISOString(),
	};
}

export async function createNotification(
	database: Db,
	input: NotificationWrite,
) {
	const allowSelf =
		input.type === "post_published" || input.type === "exchange_completed";
	if (!input.userId || (input.userId === input.actorUserId && !allowSelf)) {
		return { created: false as const };
	}

	const now = new Date();
	const result = await database.collection("notifications").updateOne(
		{
			userId: input.userId,
			type: input.type,
			entityId: input.entityId,
		},
		{
			$setOnInsert: {
				userId: input.userId,
				actorUserId: input.actorUserId ?? null,
				type: input.type,
				title: input.title,
				body: input.body,
				href: input.href,
				entityId: input.entityId,
				readAt: null,
				createdAt: now,
			},
		},
		{ upsert: true },
	);

	return { created: Boolean(result.upsertedCount) };
}

export function wantsInterestAlerts(profile: { notifyOnInterest?: unknown }) {
	return profile.notifyOnInterest !== false;
}

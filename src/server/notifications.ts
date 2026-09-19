import { auth } from "@clerk/tanstack-react-start/server";
import { createServerFn } from "@tanstack/react-start";

import {
	markNotificationsReadInputSchema,
	type NotificationItem,
	notificationInboxInputSchema,
} from "#/features/notifications/schema";
import { connectToDatabase, parseObjectId } from "#/lib/db";
import { mapNotification } from "#/lib/notifications";

export const getNotificationInboxFn = createServerFn({ method: "GET" })
	.validator(notificationInboxInputSchema)
	.handler(async ({ data }) => {
		const { isAuthenticated, userId } = await auth();
		if (!isAuthenticated || !userId) {
			return {
				isAuthenticated: false,
				unreadCount: 0,
				items: [] as NotificationItem[],
			};
		}

		const database = await connectToDatabase();
		const [unreadCount, documents] = await Promise.all([
			database.collection("notifications").countDocuments({
				userId,
				readAt: null,
			}),
			database
				.collection("notifications")
				.find({ userId })
				.sort({ createdAt: -1, _id: -1 })
				.limit(data.limit)
				.toArray(),
		]);

		return {
			isAuthenticated: true,
			unreadCount,
			items: documents.map(mapNotification),
		};
	});

export const markNotificationsReadFn = createServerFn({ method: "POST" })
	.validator(markNotificationsReadInputSchema)
	.handler(async ({ data }) => {
		const { isAuthenticated, userId } = await auth();
		if (!isAuthenticated || !userId) {
			throw new Error("You must be signed in to continue");
		}

		const database = await connectToDatabase();
		const now = new Date();
		if (data.all) {
			await database
				.collection("notifications")
				.updateMany({ userId, readAt: null }, { $set: { readAt: now } });
			return { ok: true as const };
		}

		const ids = (
			await Promise.all(data.ids.map((id) => parseObjectId(id)))
		).filter((id): id is NonNullable<typeof id> => Boolean(id));
		if (ids.length === 0) return { ok: true as const };

		await database
			.collection("notifications")
			.updateMany(
				{ _id: { $in: ids }, userId, readAt: null },
				{ $set: { readAt: now } },
			);
		return { ok: true as const };
	});

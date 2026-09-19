import type { Db } from "mongodb";
import { describe, expect, it } from "vitest";

import {
	createNotification,
	mapNotification,
	wantsInterestAlerts,
} from "#/lib/notifications";

describe("createNotification", () => {
	it("writes a unique inbox item for the recipient only", async () => {
		const stored: Array<Record<string, unknown>> = [];
		const database = {
			collection: () => ({
				updateOne: async (
					filter: Record<string, unknown>,
					update: { $setOnInsert: Record<string, unknown> },
				) => {
					const exists = stored.some(
						(item) =>
							item.userId === filter.userId &&
							item.type === filter.type &&
							item.entityId === filter.entityId,
					);
					if (exists) return { upsertedCount: 0 };
					stored.push({ ...filter, ...update.$setOnInsert });
					return { upsertedCount: 1 };
				},
			}),
		} as unknown as Db;

		await expect(
			createNotification(database, {
				userId: "owner",
				actorUserId: "owner",
				type: "interest_received",
				title: "Ignored self notify",
				body: "Should not write",
				href: "/requests",
				entityId: "interest:1",
			}),
		).resolves.toEqual({ created: false });

		await expect(
			createNotification(database, {
				userId: "owner",
				actorUserId: "helper",
				type: "interest_received",
				title: "Someone offered to help",
				body: "Asha responded to Calculus tutoring.",
				href: "/requests",
				entityId: "interest:1",
			}),
		).resolves.toEqual({ created: true });
		await expect(
			createNotification(database, {
				userId: "owner",
				actorUserId: "helper",
				type: "interest_received",
				title: "Someone offered to help",
				body: "Duplicate",
				href: "/requests",
				entityId: "interest:1",
			}),
		).resolves.toEqual({ created: false });
		expect(stored).toHaveLength(1);
	});

	it("keeps a published-post receipt for the author", async () => {
		const stored: Array<Record<string, unknown>> = [];
		const database = {
			collection: () => ({
				updateOne: async (
					filter: Record<string, unknown>,
					update: { $setOnInsert: Record<string, unknown> },
				) => {
					stored.push({ ...filter, ...update.$setOnInsert });
					return { upsertedCount: 1 };
				},
			}),
		} as unknown as Db;

		await expect(
			createNotification(database, {
				userId: "owner",
				actorUserId: "owner",
				type: "post_published",
				title: "Your request is live",
				body: "It’s on the board.",
				href: "/requests",
				entityId: "published:1",
			}),
		).resolves.toEqual({ created: true });
		expect(stored).toHaveLength(1);
	});

	it("keeps a completed-exchange receipt for both people", async () => {
		const stored: Array<Record<string, unknown>> = [];
		const database = {
			collection: () => ({
				updateOne: async (
					filter: Record<string, unknown>,
					update: { $setOnInsert: Record<string, unknown> },
				) => {
					stored.push({ ...filter, ...update.$setOnInsert });
					return { upsertedCount: 1 };
				},
			}),
		} as unknown as Db;

		await expect(
			createNotification(database, {
				userId: "owner",
				actorUserId: "owner",
				type: "exchange_completed",
				title: "Both people verified the hours",
				body: "The match is complete.",
				href: "/requests",
				entityId: "completed:1:owner",
			}),
		).resolves.toEqual({ created: true });
		expect(stored).toHaveLength(1);
	});
});

describe("mapNotification", () => {
	it("normalizes persisted documents for the inbox", () => {
		expect(
			mapNotification({
				_id: { toString: () => "n1" },
				type: "match_accepted",
				title: "Accepted",
				body: "Andrew accepted your help.",
				href: "/requests",
				entityId: "accepted:1",
				actorUserId: "owner",
				readAt: null,
				createdAt: new Date("2026-09-19T12:00:00.000Z"),
			}),
		).toMatchObject({
			id: "n1",
			type: "match_accepted",
			readAt: null,
			createdAt: "2026-09-19T12:00:00.000Z",
		});
		expect(
			mapNotification({
				_id: { toString: () => "n2" },
				type: "interest_withdrawn",
				title: "Someone withdrew their reply",
				body: "Asha withdrew interest.",
				href: "/requests",
				entityId: "interest-withdrawn:1",
				createdAt: "2026-09-19T13:00:00.000Z",
			}).type,
		).toBe("interest_withdrawn");
		expect(
			mapNotification({
				_id: { toString: () => "n4" },
				type: "hours_confirmed",
				title: "Hours are waiting on you",
				body: "Confirm the time.",
				href: "/requests",
				entityId: "hours:1",
				createdAt: "2026-09-19T14:00:00.000Z",
			}).type,
		).toBe("hours_confirmed");
		expect(
			mapNotification({
				_id: { toString: () => "n5" },
				type: "exchange_completed",
				title: "Both people verified the hours",
				body: "Ready to archive.",
				href: "/requests",
				entityId: "completed:1",
				createdAt: "2026-09-19T15:00:00.000Z",
			}).type,
		).toBe("exchange_completed");
		expect(
			mapNotification({
				_id: { toString: () => "n6" },
				type: "post_published",
				title: "Your request is live",
				body: "It’s on the board.",
				href: "/requests",
				entityId: "published:1",
				createdAt: "2026-09-19T16:00:00.000Z",
			}).type,
		).toBe("post_published");
	});
});

describe("wantsInterestAlerts", () => {
	it("defaults on and honors an explicit opt-out", () => {
		expect(wantsInterestAlerts({})).toBe(true);
		expect(wantsInterestAlerts({ notifyOnInterest: true })).toBe(true);
		expect(wantsInterestAlerts({ notifyOnInterest: false })).toBe(false);
	});
});

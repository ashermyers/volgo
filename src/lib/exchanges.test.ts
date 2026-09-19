import type { Db } from "mongodb";
import { ObjectId } from "mongodb";
import { describe, expect, it } from "vitest";

import { confirmExchange } from "#/lib/exchanges";

type UpdateShape = {
	$addToSet?: { confirmedBy?: string; creditedExchangeIds?: string };
	$set?: Record<string, unknown>;
	$setOnInsert?: Record<string, unknown>;
	$inc?: Record<string, number>;
};

function createDatabase() {
	const matchId = new ObjectId();
	const postId = new ObjectId();
	const match: Record<string, unknown> = {
		_id: matchId,
		postId: postId.toString(),
		postType: "request",
		fromUserId: "provider",
		toUserId: "recipient",
		status: "accepted",
		confirmedBy: [],
	};
	const post: Record<string, unknown> = {
		_id: postId,
		estimatedMinutes: 60,
		status: "matched",
	};
	const profiles: Record<
		string,
		{
			lifetimeMinutes: number;
			availableCredits: number;
			creditedExchangeIds: string[];
		}
	> = {
		provider: {
			lifetimeMinutes: 0,
			availableCredits: 0,
			creditedExchangeIds: [],
		},
		recipient: {
			lifetimeMinutes: 0,
			availableCredits: 0,
			creditedExchangeIds: [],
		},
	};
	let exchange: Record<string, unknown> | null = null;

	const collections = {
		matches: {
			findOne: async () => match,
			updateOne: async (_filter: unknown, rawUpdate: unknown) => {
				const update = rawUpdate as UpdateShape;
				const currentStatus = String(match.status);
				if (update.$addToSet?.confirmedBy && currentStatus !== "completed") {
					const confirmedBy = match.confirmedBy as string[];
					if (!confirmedBy.includes(update.$addToSet.confirmedBy)) {
						confirmedBy.push(update.$addToSet.confirmedBy);
					}
				}
				if (
					update.$set?.status === "completed" &&
					currentStatus === "completed"
				) {
					return { modifiedCount: 0 };
				}
				if (update.$set) Object.assign(match, update.$set);
				return { modifiedCount: 1 };
			},
		},
		helpRequests: {
			findOne: async () => post,
			updateOne: async (_filter: unknown, rawUpdate: unknown) => {
				const update = rawUpdate as UpdateShape;
				if (update.$set) Object.assign(post, update.$set);
				return { modifiedCount: 1 };
			},
		},
		exchanges: {
			createIndex: async () => "matchId_1",
			findOne: async () => exchange,
			updateOne: async (_filter: unknown, rawUpdate: unknown) => {
				const update = rawUpdate as UpdateShape;
				if (!exchange && update.$setOnInsert) {
					exchange = { _id: new ObjectId(), ...update.$setOnInsert };
					return { modifiedCount: 0, upsertedCount: 1 };
				}
				if (exchange && update.$set) Object.assign(exchange, update.$set);
				return { modifiedCount: exchange ? 1 : 0, upsertedCount: 0 };
			},
		},
		profiles: {
			updateOne: async (rawFilter: unknown, rawUpdate: unknown) => {
				const filter = rawFilter as { clerkUserId: string };
				const update = rawUpdate as UpdateShape;
				const profile = profiles[filter.clerkUserId];
				const exchangeId = update.$addToSet?.creditedExchangeIds;
				if (!profile || !exchangeId) return { modifiedCount: 0 };
				if (profile.creditedExchangeIds.includes(exchangeId)) {
					return { modifiedCount: 0 };
				}
				for (const [field, amount] of Object.entries(update.$inc ?? {})) {
					if (field === "lifetimeMinutes") profile.lifetimeMinutes += amount;
					if (field === "availableCredits") profile.availableCredits += amount;
				}
				profile.creditedExchangeIds.push(exchangeId);
				return { modifiedCount: 1 };
			},
		},
	};
	const database = {
		collection: (name: keyof typeof collections) => collections[name],
	} as unknown as Db;

	return {
		database,
		matchId,
		match,
		profiles,
		getExchange: () => exchange,
	};
}

describe("confirmExchange", () => {
	it("waits for both people and credits a completed exchange only once", async () => {
		const state = createDatabase();

		const first = await confirmExchange({
			database: state.database,
			matchId: state.matchId,
			userId: "recipient",
		});
		expect(first.status).toBe("awaiting_confirmation");
		expect(state.profiles.provider.lifetimeMinutes).toBe(0);
		expect(state.profiles.recipient.lifetimeMinutes).toBe(0);

		const second = await confirmExchange({
			database: state.database,
			matchId: state.matchId,
			userId: "provider",
		});
		expect(second.status).toBe("completed");
		expect(state.profiles.provider).toMatchObject({
			lifetimeMinutes: 60,
			availableCredits: 60,
		});
		expect(state.profiles.recipient).toMatchObject({
			lifetimeMinutes: 60,
			availableCredits: 0,
		});
		expect(state.getExchange()).toMatchObject({
			verifiedByBoth: true,
			creditState: "complete",
		});

		await confirmExchange({
			database: state.database,
			matchId: state.matchId,
			userId: "provider",
		});
		expect(state.profiles.provider.lifetimeMinutes).toBe(60);
		expect(state.profiles.provider.availableCredits).toBe(60);
		expect(state.profiles.recipient.lifetimeMinutes).toBe(60);
	});
});

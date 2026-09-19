import type { Db } from "mongodb";
import { describe, expect, it } from "vitest";

import { readCommunityStats } from "#/server/community";

describe("readCommunityStats", () => {
	it("counts only live posts and verified completed exchanges", async () => {
		const countFilters = new Map<string, unknown>();
		let exchangePipeline: unknown[] = [];
		const counts = { offers: 2, helpRequests: 3, profiles: 4 };
		const database = {
			collection: (name: keyof typeof counts | "exchanges") => ({
				countDocuments: async (filter: unknown) => {
					countFilters.set(name, filter);
					return name === "exchanges" ? 0 : counts[name];
				},
				aggregate: (pipeline: unknown[]) => {
					exchangePipeline = pipeline;
					return {
						toArray: async () => [
							{ completedExchanges: 5, verifiedMinutes: 420 },
						],
					};
				},
			}),
		} as unknown as Db;

		await expect(readCommunityStats(database)).resolves.toEqual({
			activePosts: 5,
			members: 4,
			completedExchanges: 5,
			verifiedMinutes: 420,
		});
		expect(countFilters.get("offers")).toEqual({
			status: { $in: ["active", "matched"] },
			archivedAt: { $exists: false },
		});
		expect(countFilters.get("helpRequests")).toEqual({
			status: { $in: ["open", "active", "matched"] },
			archivedAt: { $exists: false },
		});
		expect(countFilters.get("profiles")).toEqual({
			onboardingCompleted: true,
		});
		expect(exchangePipeline[0]).toEqual({
			$match: { status: "completed", verifiedByBoth: true },
		});
	});
});

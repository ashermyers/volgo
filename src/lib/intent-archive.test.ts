import type { Db } from "mongodb";
import { ObjectId } from "mongodb";
import { describe, expect, it } from "vitest";

import { archiveOwnedIntent, restoreOwnedIntent } from "#/lib/intent-archive";

type Update = {
	$set?: Record<string, unknown>;
	$unset?: Record<string, unknown>;
};

function createDatabase() {
	const postId = new ObjectId();
	const post: Record<string, unknown> = {
		_id: postId,
		userId: "owner",
		status: "open",
	};
	const matches: Array<Record<string, unknown>> = [
		{ postId: postId.toString(), status: "pending" },
		{ postId: postId.toString(), status: "accepted" },
		{ postId: postId.toString(), status: "completed" },
	];
	const helpRequests = {
		findOne: async (filter: Record<string, unknown>) =>
			filter.userId === post.userId &&
			(filter.status === undefined || filter.status === post.status)
				? post
				: null,
		updateOne: async (_filter: unknown, rawUpdate: unknown) => {
			const update = rawUpdate as Update;
			if (update.$set) Object.assign(post, update.$set);
			for (const field of Object.keys(update.$unset ?? {})) delete post[field];
			return { modifiedCount: 1 };
		},
	};
	const matchCollection = {
		updateMany: async (rawFilter: unknown, rawUpdate: unknown) => {
			const filter = rawFilter as {
				postId: string;
				status?: string | { $in: string[] };
				archivedByPost?: boolean;
				hiddenFromBoard?: boolean;
			};
			const update = rawUpdate as Update;
			let modifiedCount = 0;
			for (const match of matches) {
				const statusMatches =
					filter.status === undefined
						? true
						: typeof filter.status === "string"
							? match.status === filter.status
							: filter.status.$in.includes(String(match.status));
				if (
					match.postId !== filter.postId ||
					!statusMatches ||
					(filter.archivedByPost !== undefined &&
						match.archivedByPost !== filter.archivedByPost) ||
					(filter.hiddenFromBoard !== undefined &&
						match.hiddenFromBoard !== filter.hiddenFromBoard)
				) {
					continue;
				}
				if (update.$set) Object.assign(match, update.$set);
				for (const field of Object.keys(update.$unset ?? {})) {
					delete match[field];
				}
				modifiedCount += 1;
			}
			return { modifiedCount };
		},
	};
	const database = {
		collection: (name: string) =>
			name === "helpRequests" || name === "offers"
				? helpRequests
				: matchCollection,
	} as unknown as Db;

	return { database, postId, post, matches };
}

describe("intent archival", () => {
	it("archives only pending replies and restores them with the post", async () => {
		const state = createDatabase();

		await archiveOwnedIntent({
			database: state.database,
			postId: state.postId,
			postType: "request",
			userId: "owner",
		});
		expect(state.post).toMatchObject({
			status: "archived",
			archivedPreviousStatus: "open",
		});
		expect(state.matches.map((match) => match.status)).toEqual([
			"archived",
			"accepted",
			"completed",
		]);
		expect(state.matches[1]).toMatchObject({ hiddenFromBoard: true });
		expect(state.matches[2]).toMatchObject({ hiddenFromBoard: true });

		await restoreOwnedIntent({
			database: state.database,
			postId: state.postId,
			postType: "request",
			userId: "owner",
		});
		expect(state.post.status).toBe("open");
		expect(state.post).not.toHaveProperty("archivedAt");
		expect(state.matches.map((match) => match.status)).toEqual([
			"pending",
			"accepted",
			"completed",
		]);
		expect(state.matches[1]).not.toHaveProperty("hiddenFromBoard");
		expect(state.matches[2]).not.toHaveProperty("hiddenFromBoard");
	});

	it("rejects archival by a non-owner", async () => {
		const state = createDatabase();
		await expect(
			archiveOwnedIntent({
				database: state.database,
				postId: state.postId,
				postType: "request",
				userId: "someone-else",
			}),
		).rejects.toThrow("could not be found");
	});

	it("keeps completed posts and their matches immutable", async () => {
		const state = createDatabase();
		state.post.status = "completed";

		await expect(
			archiveOwnedIntent({
				database: state.database,
				postId: state.postId,
				postType: "request",
				userId: "owner",
			}),
		).rejects.toThrow("Completed posts stay");
		expect(state.post.status).toBe("completed");
		expect(state.matches.map((match) => match.status)).toEqual([
			"pending",
			"accepted",
			"completed",
		]);
	});

	it("archives a verified completed post only when explicitly authorized", async () => {
		const state = createDatabase();
		state.post.status = "completed";

		await archiveOwnedIntent({
			database: state.database,
			postId: state.postId,
			postType: "request",
			userId: "owner",
			allowCompleted: true,
		});
		expect(state.post).toMatchObject({
			status: "archived",
			archivedPreviousStatus: "completed",
		});
		expect(state.matches[2]).toMatchObject({
			status: "completed",
			hiddenFromBoard: true,
		});

		await restoreOwnedIntent({
			database: state.database,
			postId: state.postId,
			postType: "request",
			userId: "owner",
		});
		expect(state.post.status).toBe("completed");
	});

	it("also archives a completed offer owned by the provider", async () => {
		const state = createDatabase();
		state.post.status = "completed";

		await archiveOwnedIntent({
			database: state.database,
			postId: state.postId,
			postType: "offer",
			userId: "owner",
			allowCompleted: true,
		});
		expect(state.post.status).toBe("archived");
		expect(state.post.archivedPreviousStatus).toBe("completed");
	});
});

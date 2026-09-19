import type { Db } from "mongodb";
import { ObjectId } from "mongodb";
import { describe, expect, it } from "vitest";

import { updateOwnedIntent } from "#/lib/intent-update";

function createDatabase(status = "open") {
	const postId = new ObjectId();
	const post: Record<string, unknown> = {
		_id: postId,
		userId: "owner",
		status,
		title: "Old title",
		description: "Old description",
		skillsNeeded: ["Java"],
	};
	const database = {
		collection: () => ({
			findOne: async (filter: Record<string, unknown>) =>
				filter.userId === post.userId ? post : null,
			updateOne: async (
				filter: { status?: { $nin: string[] } },
				update: { $set: Record<string, unknown> },
			) => {
				if (filter.status?.$nin.includes(String(post.status))) {
					return { matchedCount: 0, modifiedCount: 0 };
				}
				Object.assign(post, update.$set);
				return { matchedCount: 1, modifiedCount: 1 };
			},
		}),
	} as unknown as Db;

	return { database, postId, post };
}

describe("updateOwnedIntent", () => {
	it("lets the owner change an open request", async () => {
		const state = createDatabase();
		await updateOwnedIntent({
			database: state.database,
			postId: state.postId,
			postType: "request",
			userId: "owner",
			title: "Need calculus help tonight",
			description: "Looking for an hour of exam review.",
			skills: ["Calculus"],
			minutes: 60,
			availability: "Tonight after 7",
		});
		expect(state.post).toMatchObject({
			title: "Need calculus help tonight",
			skillsNeeded: ["Calculus"],
			estimatedMinutes: 60,
		});
	});

	it("rejects edits from anyone else or completed posts", async () => {
		const owned = createDatabase();
		await expect(
			updateOwnedIntent({
				database: owned.database,
				postId: owned.postId,
				postType: "request",
				userId: "someone-else",
				title: "Need calculus help tonight",
				description: "Looking for an hour of exam review.",
				skills: ["Calculus"],
				minutes: 60,
				availability: "Tonight",
			}),
		).rejects.toThrow("could not be found");

		const completed = createDatabase("completed");
		await expect(
			updateOwnedIntent({
				database: completed.database,
				postId: completed.postId,
				postType: "request",
				userId: "owner",
				title: "Need calculus help tonight",
				description: "Looking for an hour of exam review.",
				skills: ["Calculus"],
				minutes: 60,
				availability: "Tonight",
			}),
		).rejects.toThrow("verified history");

		const archived = createDatabase("archived");
		await expect(
			updateOwnedIntent({
				database: archived.database,
				postId: archived.postId,
				postType: "request",
				userId: "owner",
				title: "Need calculus help tonight",
				description: "Looking for an hour of exam review.",
				skills: ["Calculus"],
				minutes: 60,
				availability: "Tonight",
			}),
		).rejects.toThrow("Restore this post");
	});
});

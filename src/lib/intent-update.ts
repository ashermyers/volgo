import type { Db, ObjectId } from "mongodb";

import type { IntentKind } from "#/lib/matching";

function collectionFor(postType: IntentKind) {
	return postType === "offer" ? "offers" : "helpRequests";
}

export async function updateOwnedIntent({
	database,
	postId,
	postType,
	userId,
	title,
	description,
	skills,
	minutes,
	availability,
}: {
	database: Db;
	postId: ObjectId;
	postType: IntentKind;
	userId: string;
	title: string;
	description: string;
	skills: string[];
	minutes: number | null;
	availability: string | null;
}) {
	const collection = database.collection(collectionFor(postType));
	const post = await collection.findOne({ _id: postId, userId });
	if (!post) throw new Error("That post could not be found");
	if (post.status === "archived") {
		throw new Error("Restore this post before editing it");
	}
	if (post.status === "completed") {
		throw new Error("Completed posts stay in your verified history");
	}

	const now = new Date();
	const fields =
		postType === "offer"
			? {
					title,
					description,
					skills,
					availableMinutes: minutes,
					availability,
					updatedAt: now,
				}
			: {
					title,
					description,
					skillsNeeded: skills,
					estimatedMinutes: minutes,
					availability,
					updatedAt: now,
				};

	const result = await collection.updateOne(
		{ _id: postId, userId, status: { $nin: ["archived", "completed"] } },
		{ $set: fields },
	);
	if (result.modifiedCount === 0 && result.matchedCount === 0) {
		throw new Error("That post changed before it could be updated");
	}

	return { ok: true as const, updated: true as const };
}

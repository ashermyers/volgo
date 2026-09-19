import type { Db, ObjectId } from "mongodb";

import type { IntentKind } from "#/lib/matching";

function collectionFor(postType: IntentKind) {
	return postType === "offer" ? "offers" : "helpRequests";
}

async function archivePendingMatches(
	database: Db,
	postId: ObjectId,
	now = new Date(),
) {
	await database.collection("matches").updateMany(
		{ postId: postId.toString(), status: "pending" },
		{
			$set: {
				status: "archived",
				archivedByPost: true,
				archivedAt: now,
				updatedAt: now,
			},
		},
	);
}

async function hideCompletedMatchesFromBoard(
	database: Db,
	postId: ObjectId,
	now = new Date(),
) {
	await database.collection("matches").updateMany(
		{
			postId: postId.toString(),
			status: { $in: ["accepted", "awaiting_confirmation", "completed"] },
		},
		{
			$set: {
				hiddenFromBoard: true,
				updatedAt: now,
			},
		},
	);
}

export async function archiveOwnedIntent({
	database,
	postId,
	postType,
	userId,
	allowCompleted = false,
}: {
	database: Db;
	postId: ObjectId;
	postType: IntentKind;
	userId: string;
	allowCompleted?: boolean;
}) {
	const collection = database.collection(collectionFor(postType));
	const post = await collection.findOne({ _id: postId, userId });
	if (!post) throw new Error("That post could not be found");
	if (post.status === "completed" && !allowCompleted) {
		throw new Error("Completed posts stay in your verified history");
	}
	if (post.status === "archived") {
		await Promise.all([
			archivePendingMatches(database, postId),
			hideCompletedMatchesFromBoard(database, postId),
		]);
		return { ok: true as const, archived: true as const };
	}

	const now = new Date();
	const result = await collection.updateOne(
		{ _id: postId, userId, status: post.status },
		{
			$set: {
				status: "archived",
				archivedAt: now,
				archivedPreviousStatus: post.status,
				updatedAt: now,
			},
		},
	);
	if (result.modifiedCount === 0) {
		const current = await collection.findOne({ _id: postId, userId });
		if (current?.status === "archived") {
			return { ok: true as const, archived: true as const };
		}
		if (current?.status === "completed") {
			if (allowCompleted) {
				throw new Error(
					"That completed post changed before it could be archived",
				);
			}
			throw new Error("Completed posts stay in your verified history");
		}
		throw new Error("That post changed before it could be archived");
	}

	await Promise.all([
		archivePendingMatches(database, postId, now),
		hideCompletedMatchesFromBoard(database, postId, now),
	]);

	return { ok: true as const, archived: true as const };
}

export async function restoreOwnedIntent({
	database,
	postId,
	postType,
	userId,
}: {
	database: Db;
	postId: ObjectId;
	postType: IntentKind;
	userId: string;
}) {
	const collection = database.collection(collectionFor(postType));
	const post = await collection.findOne({
		_id: postId,
		userId,
		status: "archived",
	});
	if (!post) throw new Error("That archived post could not be found");

	const allowedStatuses =
		postType === "offer"
			? new Set(["active", "matched", "completed"])
			: new Set(["open", "active", "matched", "completed"]);
	const previousStatus =
		typeof post.archivedPreviousStatus === "string" &&
		allowedStatuses.has(post.archivedPreviousStatus)
			? post.archivedPreviousStatus
			: postType === "offer"
				? "active"
				: "open";
	const now = new Date();

	const result = await collection.updateOne(
		{ _id: postId, userId, status: "archived" },
		{
			$set: { status: previousStatus, updatedAt: now },
			$unset: { archivedAt: "", archivedPreviousStatus: "" },
		},
	);
	if (result.modifiedCount === 0) {
		throw new Error("That archived post changed before it could be restored");
	}

	await Promise.all([
		database.collection("matches").updateMany(
			{
				postId: postId.toString(),
				status: "archived",
				archivedByPost: true,
			},
			{
				$set: { status: "pending", updatedAt: now },
				$unset: { archivedByPost: "", archivedAt: "" },
			},
		),
		database.collection("matches").updateMany(
			{
				postId: postId.toString(),
				hiddenFromBoard: true,
			},
			{
				$set: { updatedAt: now },
				$unset: { hiddenFromBoard: "" },
			},
		),
	]);

	return { ok: true as const, restored: true as const };
}

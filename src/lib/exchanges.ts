import type { Db, ObjectId } from "mongodb";

import type { IntentKind } from "#/lib/matching";

function asStringArray(value: unknown) {
	return Array.isArray(value)
		? value.filter((item): item is string => typeof item === "string")
		: [];
}

function asNullableNumber(value: unknown) {
	return typeof value === "number" ? value : null;
}

function collectionFor(postType: IntentKind) {
	return postType === "offer" ? "offers" : "helpRequests";
}

export async function confirmExchange({
	database,
	matchId,
	userId,
}: {
	database: Db;
	matchId: ObjectId;
	userId: string;
}) {
	const match = await database.collection("matches").findOne({ _id: matchId });

	if (
		!match ||
		(String(match.toUserId) !== userId && String(match.fromUserId) !== userId)
	) {
		throw new Error("That match could not be found");
	}

	if (match.status === "completed") {
		return {
			id: match._id.toString(),
			status: "completed" as const,
			waitingForPartner: false,
		};
	}

	if (match.status !== "accepted" && match.status !== "awaiting_confirmation") {
		throw new Error("Accept this match before marking it complete");
	}

	const postType: IntentKind = match.postType === "offer" ? "offer" : "request";
	const { ObjectId } = await import("mongodb");
	const postIdValue = String(match.postId);
	if (!ObjectId.isValid(postIdValue)) {
		throw new Error("That post could not be found");
	}

	const post = await database
		.collection(collectionFor(postType))
		.findOne({ _id: new ObjectId(postIdValue) });
	if (!post) {
		throw new Error("That post could not be found");
	}

	const minutes =
		asNullableNumber(post.availableMinutes) ??
		asNullableNumber(post.estimatedMinutes) ??
		60;
	const providerUserId =
		postType === "request" ? String(match.fromUserId) : String(match.toUserId);
	const recipientUserId =
		postType === "request" ? String(match.toUserId) : String(match.fromUserId);
	const now = new Date();

	await database.collection("matches").updateOne(
		{ _id: match._id, status: { $ne: "completed" } },
		{
			$addToSet: { confirmedBy: userId },
			$set: { status: "awaiting_confirmation", updatedAt: now },
		},
	);

	const confirmedMatch = await database
		.collection("matches")
		.findOne({ _id: match._id });
	const confirmedBy = asStringArray(confirmedMatch?.confirmedBy);
	const bothConfirmed =
		confirmedBy.includes(String(match.fromUserId)) &&
		confirmedBy.includes(String(match.toUserId));

	if (!bothConfirmed) {
		return {
			id: match._id.toString(),
			status: "awaiting_confirmation" as const,
			waitingForPartner: true,
		};
	}

	const completion = await database.collection("matches").updateOne(
		{
			_id: match._id,
			status: { $ne: "completed" },
			confirmedBy: {
				$all: [String(match.fromUserId), String(match.toUserId)],
			},
		},
		{
			$set: {
				status: "completed",
				completedAt: now,
				updatedAt: now,
			},
		},
	);

	if (completion.modifiedCount > 0) {
		await Promise.all([
			database
				.collection(collectionFor(postType))
				.updateOne(
					{ _id: post._id },
					{ $set: { status: "completed", updatedAt: now } },
				),
			database.collection("exchanges").updateOne(
				{ matchId: match._id.toString() },
				{
					$setOnInsert: {
						matchId: match._id.toString(),
						providerUserId,
						recipientUserId,
						minutes,
						status: "completed",
						verifiedByBoth: true,
						createdAt: now,
					},
				},
				{ upsert: true },
			),
			database.collection("profiles").updateOne(
				{ clerkUserId: providerUserId },
				{
					$inc: {
						lifetimeMinutes: minutes,
						availableCredits: minutes,
					},
					$set: { updatedAt: now },
				},
			),
			database.collection("profiles").updateOne(
				{ clerkUserId: recipientUserId },
				{
					$inc: { lifetimeMinutes: minutes },
					$set: { updatedAt: now },
				},
			),
		]);
	}

	return {
		id: match._id.toString(),
		status: "completed" as const,
		waitingForPartner: false,
	};
}

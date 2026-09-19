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

	if (
		match.status !== "accepted" &&
		match.status !== "awaiting_confirmation" &&
		match.status !== "completed"
	) {
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

	if (match.status !== "completed") {
		await database.collection("matches").updateOne(
			{ _id: match._id, status: { $ne: "completed" } },
			{
				$addToSet: { confirmedBy: userId },
				$set: { status: "awaiting_confirmation", updatedAt: now },
			},
		);
	}

	const confirmedMatch = await database
		.collection("matches")
		.findOne({ _id: match._id });
	const confirmedBy = asStringArray(confirmedMatch?.confirmedBy);
	const bothConfirmed =
		confirmedBy.includes(String(match.fromUserId)) &&
		confirmedBy.includes(String(match.toUserId));

	if (!bothConfirmed) {
		if (match.status === "completed") {
			return {
				id: match._id.toString(),
				status: "completed" as const,
				waitingForPartner: false,
			};
		}
		return {
			id: match._id.toString(),
			status: "awaiting_confirmation" as const,
			waitingForPartner: true,
		};
	}

	await database.collection("matches").updateOne(
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

	const matchIdValue = match._id.toString();
	const exchanges = database.collection("exchanges");
	await exchanges.createIndex({ matchId: 1 }, { unique: true });
	await Promise.all([
		database
			.collection(collectionFor(postType))
			.updateOne(
				{ _id: post._id },
				{ $set: { status: "completed", updatedAt: now } },
			),
		exchanges.updateOne(
			{ matchId: matchIdValue },
			{
				$setOnInsert: {
					matchId: matchIdValue,
					providerUserId,
					recipientUserId,
					minutes,
					status: "completed",
					verifiedByBoth: true,
					completedAt: now,
					creditState: "pending",
					createdAt: now,
				},
			},
			{ upsert: true },
		),
	]);

	const exchange = await exchanges.findOne({ matchId: matchIdValue });
	if (exchange?.creditState === "pending") {
		await Promise.all([
			database.collection("profiles").updateOne(
				{
					clerkUserId: providerUserId,
					creditedExchangeIds: { $ne: matchIdValue },
				},
				{
					$inc: {
						lifetimeMinutes: minutes,
						availableCredits: minutes,
					},
					$addToSet: { creditedExchangeIds: matchIdValue },
					$set: { updatedAt: now },
				},
			),
			database.collection("profiles").updateOne(
				{
					clerkUserId: recipientUserId,
					creditedExchangeIds: { $ne: matchIdValue },
				},
				{
					$inc: { lifetimeMinutes: minutes },
					$addToSet: { creditedExchangeIds: matchIdValue },
					$set: { updatedAt: now },
				},
			),
		]);
		await exchanges.updateOne(
			{ _id: exchange._id, creditState: "pending" },
			{ $set: { creditState: "complete", creditedAt: new Date() } },
		);
	}

	return {
		id: match._id.toString(),
		status: "completed" as const,
		waitingForPartner: false,
	};
}

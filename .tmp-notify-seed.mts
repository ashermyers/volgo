import { readFileSync } from "node:fs";

function loadEnv(path: string) {
	try {
		for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
			const trimmed = line.trim();
			if (!trimmed || trimmed.startsWith("#")) continue;
			const eq = trimmed.indexOf("=");
			if (eq === -1) continue;
			const key = trimmed.slice(0, eq).trim();
			const value = trimmed
				.slice(eq + 1)
				.trim()
				.replace(/^["']|["']$/g, "");
			if (key && !process.env[key]) process.env[key] = value;
		}
	} catch {
		// Optional env file.
	}
}

loadEnv(".env");
loadEnv(".env.local");

const { confirmExchange } = await import("./src/lib/exchanges.ts");
const { connectToDatabase } = await import("./src/lib/db.ts");
const { createNotification } = await import("./src/lib/notifications.ts");

const ANDREW = "user_3JYDHGkyfUe1yKJ98scB8kFLpjG";
const ASHER_POST_TITLE = "Notification flow check";
const ANDREW_POST_TITLE = "Lewis structures review tonight";

const database = await connectToDatabase();
const asherPost = await database.collection("helpRequests").findOne({
	title: { $in: ["Need help studying for Calculus", ASHER_POST_TITLE] },
});
if (!asherPost) {
	throw new Error(
		"Could not find Asher’s signed-in account from an existing request",
	);
}
const asherId = String(asherPost.userId);

const now = new Date();
let asherCheck = await database.collection("helpRequests").findOne({
	userId: asherId,
	title: ASHER_POST_TITLE,
});
if (!asherCheck) {
	const inserted = await database.collection("helpRequests").insertOne({
		userId: asherId,
		displayName: "Asher",
		title: ASHER_POST_TITLE,
		description:
			"Temporary post so incoming interest, accept, and hour confirmation can be verified.",
		skillsNeeded: ["Notifications"],
		estimatedMinutes: 45,
		availability: "Now",
		status: "open",
		createdAt: now,
		updatedAt: now,
	});
	asherCheck = await database
		.collection("helpRequests")
		.findOne({ _id: inserted.insertedId });
}
if (!asherCheck) throw new Error("Failed to create Asher check request");

let andrewPost = await database.collection("helpRequests").findOne({
	userId: ANDREW,
	title: ANDREW_POST_TITLE,
	status: { $in: ["open", "active", "matched"] },
});
if (!andrewPost) {
	const inserted = await database.collection("helpRequests").insertOne({
		userId: ANDREW,
		displayName: "Andrew",
		title: ANDREW_POST_TITLE,
		description:
			"I want a second look at Lewis structures before class. Forty-five minutes is plenty.",
		skillsNeeded: ["Chemistry", "Lewis Structures"],
		estimatedMinutes: 45,
		availability: "Tonight",
		status: "open",
		createdAt: now,
		updatedAt: now,
	});
	andrewPost = await database
		.collection("helpRequests")
		.findOne({ _id: inserted.insertedId });
}
if (!andrewPost) throw new Error("Failed to create Andrew live request");

const incoming = await database.collection("matches").findOne({
	postId: asherCheck._id.toString(),
	fromUserId: ANDREW,
	toUserId: asherId,
	status: { $in: ["pending", "accepted", "awaiting_confirmation"] },
});
const matchId =
	incoming?._id ??
	(
		await database.collection("matches").insertOne({
			postId: asherCheck._id.toString(),
			postType: "request",
			fromUserId: ANDREW,
			toUserId: asherId,
			score: 72,
			explanation: "Andrew’s chemistry background fits this check.",
			status: "pending",
			createdAt: now,
		})
	).insertedId;

await createNotification(database, {
	userId: asherId,
	actorUserId: ANDREW,
	type: "interest_received",
	title: "Someone offered to help",
	body: `Andrew responded to “${ASHER_POST_TITLE}”.`,
	href: "/requests",
	entityId: `interest:${matchId.toString()}:${now.getTime()}`,
});

const step = process.argv[2] ?? "seed";
if (step === "confirm-andrew") {
	const active = await database.collection("matches").findOne({
		fromUserId: ANDREW,
		toUserId: asherId,
		postId: asherCheck._id.toString(),
	});
	if (!active) throw new Error("No match for Andrew to confirm");
	const result = await confirmExchange({
		database,
		matchId: active._id,
		userId: ANDREW,
	});
	await createNotification(database, {
		userId: asherId,
		actorUserId: ANDREW,
		type:
			result.status === "completed" ? "exchange_completed" : "hours_confirmed",
		title:
			result.status === "completed"
				? "Both people verified the hours"
				: "Hours are waiting on you",
		body:
			result.status === "completed"
				? `“${ASHER_POST_TITLE}” is complete and ready to archive.`
				: `Andrew confirmed time on “${ASHER_POST_TITLE}”.`,
		href: "/requests",
		entityId:
			result.status === "completed"
				? `completed:${active._id.toString()}:${asherId}`
				: `hours:${active._id.toString()}:${ANDREW}`,
	});
	console.log(
		JSON.stringify({
			step,
			asherPostId: asherCheck._id.toString(),
			andrewPostId: andrewPost._id.toString(),
			matchId: active._id.toString(),
			status: result.status,
		}),
	);
	process.exit(0);
}

console.log(
	JSON.stringify({
		step,
		asherPostId: asherCheck._id.toString(),
		andrewPostId: andrewPost._id.toString(),
		matchId: matchId.toString(),
	}),
);

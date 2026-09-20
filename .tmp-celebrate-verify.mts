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

const { connectToDatabase } = await import("./src/lib/db.ts");
const { createNotification } = await import("./src/lib/notifications.ts");

const database = await connectToDatabase();
const post = await database.collection("helpRequests").findOne({
	title: "Need precalculus tutoring for quadratic equations",
	status: { $in: ["completed", "matched"] },
});
if (!post) throw new Error("Could not find the fulfilled precalc request");

const asherId = String(post.userId);
const match = await database.collection("matches").findOne({
	postId: post._id.toString(),
	status: "completed",
});
if (!match) throw new Error("Could not find the completed match");

const helperId =
	String(match.fromUserId) === asherId
		? String(match.toUserId)
		: String(match.fromUserId);
const stamp = Date.now().toString();

const thankYou = await createNotification(database, {
	userId: asherId,
	actorUserId: helperId,
	type: "thank_you_received",
	title: "A thank-you from Andrew",
	body: "You made this so much easier. Thank you for showing up.",
	href: "/requests",
	entityId: `thankyou-verify:${match._id.toString()}:${stamp}`,
});

const fulfilled = await createNotification(database, {
	userId: asherId,
	actorUserId: helperId,
	type: "request_fulfilled",
	title: "Your request was fulfilled",
	body: `“${String(post.title)}” is complete. You can send Andrew a thank-you.`,
	href: "/requests",
	entityId: `fulfilled-verify:${match._id.toString()}:${stamp}`,
});

console.log(
	JSON.stringify({
		asherId,
		matchId: match._id.toString(),
		thankYou,
		fulfilled,
	}),
);
process.exit(0);

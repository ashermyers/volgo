import type { Db, MongoClient, ObjectId } from "mongodb";

// Connection string from the MongoDB atlas dashboard
const uri = process.env.MONGODB_URI;

let connected = false;
let client: MongoClient;
let indexesReady = false;

async function ensureIndexes(database: Db) {
	if (indexesReady) return;

	await Promise.all([
		database
			.collection("offers")
			.createIndex({ status: 1, createdAt: -1, _id: -1 }),
		database
			.collection("offers")
			.createIndex({ userId: 1, status: 1, createdAt: -1, _id: -1 }),
		database
			.collection("helpRequests")
			.createIndex({ status: 1, createdAt: -1, _id: -1 }),
		database
			.collection("helpRequests")
			.createIndex({ userId: 1, status: 1, createdAt: -1, _id: -1 }),
		database
			.collection("matches")
			.createIndex({ toUserId: 1, status: 1, createdAt: -1, _id: -1 }),
		database
			.collection("matches")
			.createIndex({ fromUserId: 1, status: 1, createdAt: -1, _id: -1 }),
		database.collection("matches").createIndex({ postId: 1, status: 1 }),
		database
			.collection("profiles")
			.createIndex({ discoverable: 1, displayName: 1, _id: 1 }),
		database.collection("exchanges").createIndex({
			status: 1,
			verifiedByBoth: 1,
			providerUserId: 1,
		}),
	]);
	indexesReady = true;
}

export async function connectToDatabase(): Promise<Db> {
	if (!uri) {
		throw new Error("MONGODB_URI is not defined in environment variables");
	}

	if (!connected) {
		try {
			const { MongoClient } = await import("mongodb");
			client = new MongoClient(uri);
			await client.connect();
			connected = true;
		} catch (error) {
			throw new Error(
				`Failed to connect to database: ${
					error instanceof Error ? error.message : "Unknown error"
				}`,
			);
		}
	}
	const database = client.db("hackathon");
	await ensureIndexes(database);
	return database;
}

export async function parseObjectId(value: string): Promise<ObjectId | null> {
	const { ObjectId } = await import("mongodb");
	return ObjectId.isValid(value) ? new ObjectId(value) : null;
}

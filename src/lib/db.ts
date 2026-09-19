import type { Db, MongoClient, ObjectId } from "mongodb";

// Connection string from the MongoDB atlas dashboard
const uri = process.env.MONGODB_URI;

let connected = false;
let client: MongoClient;

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
	return client.db("hackathon");
}

export async function parseObjectId(value: string): Promise<ObjectId | null> {
	const { ObjectId } = await import("mongodb");
	return ObjectId.isValid(value) ? new ObjectId(value) : null;
}

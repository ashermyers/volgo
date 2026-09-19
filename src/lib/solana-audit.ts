import type { Db, Document } from "mongodb";

const MEMO_PROGRAM_ID = "MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr";
const CLAIM_TIMEOUT_MS = 2 * 60 * 1000;

export type SolanaAuditStatus =
	| "pending"
	| "submitting"
	| "submitted"
	| "confirmed"
	| "failed"
	| "unconfigured";

export type SolanaAuditRecord = {
	status: SolanaAuditStatus;
	network: string;
	receiptId: string;
	receiptHash: string;
	authority: string | null;
	signature: string | null;
	slot: number | null;
	explorerUrl: string | null;
};

type AuditReceipt = {
	app: "VOLGO";
	version: 1;
	receiptId: string;
	completedAt: string;
	minutes: number;
	providerCommitment: string;
	recipientCommitment: string;
};

type SolanaConfig = {
	network: string;
	rpcUrl: string;
	secretKey: Uint8Array;
};

async function sha256(value: string) {
	const { createHash } = await import("node:crypto");
	return createHash("sha256").update(value).digest("hex");
}

function safeError(error: unknown) {
	return (
		error instanceof Error ? error.message : "Unknown Solana error"
	).slice(0, 300);
}

function networkName() {
	return process.env.SOLANA_NETWORK?.trim() || "devnet";
}

function explorerUrl(signature: string, network: string) {
	if (network === "mainnet-beta") {
		return `https://explorer.solana.com/tx/${signature}`;
	}
	if (network === "devnet" || network === "testnet") {
		return `https://explorer.solana.com/tx/${signature}?cluster=${network}`;
	}
	return null;
}

function parseSecretKey(value: string) {
	const trimmed = value.trim();
	const bytes = trimmed.startsWith("[")
		? Uint8Array.from(JSON.parse(trimmed) as number[])
		: Uint8Array.from(Buffer.from(trimmed, "base64"));

	if (bytes.length !== 64) {
		throw new Error("SOLANA_AUTHORITY_SECRET_KEY must contain 64 bytes");
	}
	return bytes;
}

async function getConfig(): Promise<SolanaConfig | null> {
	if (process.env.SOLANA_AUDIT_ENABLED === "false") return null;

	const secret = process.env.SOLANA_AUTHORITY_SECRET_KEY;
	if (!secret) return null;

	const network = networkName();
	const { clusterApiUrl } = await import("@solana/web3.js");
	const defaultRpc =
		network === "devnet" || network === "testnet" || network === "mainnet-beta"
			? clusterApiUrl(network)
			: null;
	const rpcUrl = process.env.SOLANA_RPC_URL?.trim() || defaultRpc;
	if (!rpcUrl) {
		throw new Error("SOLANA_RPC_URL is required for a custom Solana network");
	}

	return {
		network,
		rpcUrl,
		secretKey: parseSecretKey(secret),
	};
}

export async function getSolanaAuditPublicConfig() {
	const network = networkName();
	try {
		const config = await getConfig();
		if (!config) {
			return { configured: false, network, authority: null };
		}
		const { Keypair } = await import("@solana/web3.js");
		return {
			configured: true,
			network: config.network,
			authority: Keypair.fromSecretKey(config.secretKey).publicKey.toBase58(),
		};
	} catch {
		return { configured: false, network, authority: null };
	}
}

export async function buildAuditReceipt({
	matchId,
	providerUserId,
	recipientUserId,
	minutes,
	completedAt,
}: {
	matchId: string;
	providerUserId: string;
	recipientUserId: string;
	minutes: number;
	completedAt: Date;
}) {
	const receipt: AuditReceipt = {
		app: "VOLGO",
		version: 1,
		receiptId: await sha256(`volgo:exchange:v1:${matchId}`),
		completedAt: completedAt.toISOString(),
		minutes,
		providerCommitment: await sha256(`volgo:provider:v1:${providerUserId}`),
		recipientCommitment: await sha256(`volgo:recipient:v1:${recipientUserId}`),
	};
	const memo = JSON.stringify(receipt);

	return {
		receipt,
		memo,
		receiptHash: await sha256(memo),
		referenceBytes: Uint8Array.from(
			Buffer.from(await sha256(`volgo:solana-reference:v1:${matchId}`), "hex"),
		),
	};
}

export async function createSignedAuditTransaction({
	memo,
	referenceBytes,
	secretKey,
	blockhash,
}: {
	memo: string;
	referenceBytes: Uint8Array;
	secretKey: Uint8Array;
	blockhash: string;
}) {
	const { Keypair, PublicKey, Transaction, TransactionInstruction } =
		await import("@solana/web3.js");
	const authority = Keypair.fromSecretKey(secretKey);
	const referenceKeypair = Keypair.fromSeed(referenceBytes);
	const reference = referenceKeypair.publicKey;
	const transaction = new Transaction({
		feePayer: authority.publicKey,
		recentBlockhash: blockhash,
	}).add(
		new TransactionInstruction({
			programId: new PublicKey(MEMO_PROGRAM_ID),
			keys: [
				{
					pubkey: authority.publicKey,
					isSigner: true,
					isWritable: false,
				},
				{ pubkey: reference, isSigner: true, isWritable: false },
			],
			data: Buffer.from(memo, "utf8"),
		}),
	);
	transaction.sign(authority, referenceKeypair);

	return {
		transaction,
		authority: authority.publicKey,
		reference,
	};
}

function publicAudit(document: Document | null): SolanaAuditRecord | null {
	const audit = document?.audit;
	if (!audit || typeof audit !== "object") return null;

	return {
		status:
			audit.status === "submitting" ||
			audit.status === "submitted" ||
			audit.status === "confirmed" ||
			audit.status === "failed" ||
			audit.status === "unconfigured"
				? audit.status
				: "pending",
		network: typeof audit.network === "string" ? audit.network : networkName(),
		receiptId: typeof audit.receiptId === "string" ? audit.receiptId : "",
		receiptHash: typeof audit.receiptHash === "string" ? audit.receiptHash : "",
		authority: typeof audit.authority === "string" ? audit.authority : null,
		signature: typeof audit.signature === "string" ? audit.signature : null,
		slot: typeof audit.slot === "number" ? audit.slot : null,
		explorerUrl:
			typeof audit.explorerUrl === "string" ? audit.explorerUrl : null,
	};
}

export async function findExistingReceipt({
	connection,
	reference,
	authority,
	memo,
}: {
	connection: import("@solana/web3.js").Connection;
	reference: import("@solana/web3.js").PublicKey;
	authority: import("@solana/web3.js").PublicKey;
	memo: string;
}) {
	const signatures = await connection.getSignaturesForAddress(
		reference,
		{ limit: 10 },
		"confirmed",
	);

	for (const item of signatures) {
		if (item.err) continue;
		const transaction = await connection.getParsedTransaction(item.signature, {
			commitment: "confirmed",
			maxSupportedTransactionVersion: 0,
		});
		if (!transaction || transaction.meta?.err) continue;

		const authoritySigned = transaction.transaction.message.accountKeys.some(
			(key) => key.signer && key.pubkey.equals(authority),
		);
		const memoMatches = transaction.transaction.message.instructions.some(
			(instruction) =>
				"parsed" in instruction &&
				instruction.program === "spl-memo" &&
				instruction.parsed === memo,
		);

		if (authoritySigned && memoMatches) {
			return { signature: item.signature, slot: item.slot };
		}
	}

	return null;
}

export async function ensureSolanaAudit({
	database,
	matchId,
}: {
	database: Db;
	matchId: string;
}): Promise<SolanaAuditRecord | null> {
	const exchanges = database.collection("exchanges");
	const exchange = await exchanges.findOne({
		matchId,
		status: "completed",
		verifiedByBoth: true,
	});
	if (!exchange) return null;

	const completedAt =
		exchange.completedAt instanceof Date
			? exchange.completedAt
			: exchange.createdAt instanceof Date
				? exchange.createdAt
				: new Date(String(exchange.completedAt ?? exchange.createdAt));
	const receipt = await buildAuditReceipt({
		matchId,
		providerUserId: String(exchange.providerUserId),
		recipientUserId: String(exchange.recipientUserId),
		minutes: Number(exchange.minutes),
		completedAt,
	});
	const network = networkName();

	if (exchange.audit?.status === "confirmed") {
		return publicAudit(exchange);
	}

	let config: SolanaConfig | null;
	try {
		config = await getConfig();
	} catch (error) {
		await exchanges.updateOne(
			{ _id: exchange._id },
			{
				$set: {
					audit: {
						status: "failed",
						network,
						receiptId: receipt.receipt.receiptId,
						receiptHash: receipt.receiptHash,
						authority: null,
						signature: null,
						slot: null,
						explorerUrl: null,
						error: safeError(error),
						updatedAt: new Date(),
					},
				},
			},
		);
		return publicAudit(await exchanges.findOne({ _id: exchange._id }));
	}

	if (!config) {
		await exchanges.updateOne(
			{ _id: exchange._id, "audit.status": { $ne: "confirmed" } },
			{
				$set: {
					audit: {
						status: "unconfigured",
						network,
						receiptId: receipt.receipt.receiptId,
						receiptHash: receipt.receiptHash,
						authority: null,
						signature: null,
						slot: null,
						explorerUrl: null,
						updatedAt: new Date(),
					},
				},
			},
		);
		return publicAudit(await exchanges.findOne({ _id: exchange._id }));
	}

	const { Connection, Keypair } = await import("@solana/web3.js");
	const connection = new Connection(config.rpcUrl, "confirmed");
	const authority = Keypair.fromSecretKey(config.secretKey);
	const reference = Keypair.fromSeed(receipt.referenceBytes).publicKey;

	try {
		const existing = await findExistingReceipt({
			connection,
			reference,
			authority: authority.publicKey,
			memo: receipt.memo,
		});
		if (existing) {
			await exchanges.updateOne(
				{ _id: exchange._id },
				{
					$set: {
						audit: {
							status: "confirmed",
							network: config.network,
							receiptId: receipt.receipt.receiptId,
							receiptHash: receipt.receiptHash,
							authority: authority.publicKey.toBase58(),
							signature: existing.signature,
							slot: existing.slot,
							explorerUrl: explorerUrl(existing.signature, config.network),
							confirmedAt: new Date(),
							updatedAt: new Date(),
						},
					},
				},
			);
			return publicAudit(await exchanges.findOne({ _id: exchange._id }));
		}

		const now = new Date();
		const claim = await exchanges.updateOne(
			{
				_id: exchange._id,
				"audit.status": { $ne: "confirmed" },
				$or: [
					{ "audit.status": { $nin: ["submitting", "submitted"] } },
					{
						"audit.updatedAt": {
							$lt: new Date(now.getTime() - CLAIM_TIMEOUT_MS),
						},
					},
				],
			},
			{
				$set: {
					"audit.status": "submitting",
					"audit.network": config.network,
					"audit.receiptId": receipt.receipt.receiptId,
					"audit.receiptHash": receipt.receiptHash,
					"audit.authority": authority.publicKey.toBase58(),
					"audit.updatedAt": now,
				},
				$inc: { "audit.attempts": 1 },
			},
		);
		if (claim.modifiedCount === 0) {
			return publicAudit(await exchanges.findOne({ _id: exchange._id }));
		}

		const latest = await connection.getLatestBlockhash("confirmed");
		const { transaction } = await createSignedAuditTransaction({
			memo: receipt.memo,
			referenceBytes: receipt.referenceBytes,
			secretKey: config.secretKey,
			blockhash: latest.blockhash,
		});
		const signature = await connection.sendRawTransaction(
			transaction.serialize(),
			{ maxRetries: 3, skipPreflight: false },
		);
		await exchanges.updateOne(
			{ _id: exchange._id },
			{
				$set: {
					"audit.status": "submitted",
					"audit.signature": signature,
					"audit.explorerUrl": explorerUrl(signature, config.network),
					"audit.updatedAt": new Date(),
				},
			},
		);

		const confirmation = await connection.confirmTransaction(
			{
				signature,
				blockhash: latest.blockhash,
				lastValidBlockHeight: latest.lastValidBlockHeight,
			},
			"confirmed",
		);
		if (confirmation.value.err) {
			throw new Error("Solana rejected the audit transaction");
		}

		await exchanges.updateOne(
			{ _id: exchange._id },
			{
				$set: {
					"audit.status": "confirmed",
					"audit.slot": confirmation.context.slot,
					"audit.confirmedAt": new Date(),
					"audit.updatedAt": new Date(),
				},
				$unset: { "audit.error": "" },
			},
		);
	} catch (error) {
		await exchanges.updateOne(
			{ _id: exchange._id, "audit.status": { $ne: "confirmed" } },
			{
				$set: {
					"audit.status": "failed",
					"audit.error": safeError(error),
					"audit.updatedAt": new Date(),
				},
			},
		);
	}

	return publicAudit(await exchanges.findOne({ _id: exchange._id }));
}

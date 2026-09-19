import type { Connection } from "@solana/web3.js";
import { Keypair, Transaction } from "@solana/web3.js";
import { describe, expect, it } from "vitest";

import {
	buildAuditReceipt,
	createSignedAuditTransaction,
	findExistingReceipt,
} from "#/lib/solana-audit";

const exchange = {
	matchId: "66f000000000000000000001",
	providerUserId: "user_provider_private",
	recipientUserId: "user_recipient_private",
	minutes: 90,
	completedAt: new Date("2026-09-19T19:00:00.000Z"),
};

describe("Solana audit receipts", () => {
	it("is deterministic and contains no raw participant identifiers", async () => {
		const first = await buildAuditReceipt(exchange);
		const second = await buildAuditReceipt(exchange);

		expect(second).toEqual(first);
		expect(first.memo).not.toContain(exchange.matchId);
		expect(first.memo).not.toContain(exchange.providerUserId);
		expect(first.memo).not.toContain(exchange.recipientUserId);
		expect(first.receipt.providerCommitment).toHaveLength(64);
		expect(first.receipt.recipientCommitment).toHaveLength(64);
		expect(first.receiptHash).toHaveLength(64);
		expect(first.referenceBytes).toHaveLength(32);
		expect(Buffer.byteLength(first.memo, "utf8")).toBeLessThanOrEqual(566);
	});

	it("changes its hash when auditable hours change", async () => {
		const original = await buildAuditReceipt(exchange);
		const changed = await buildAuditReceipt({ ...exchange, minutes: 120 });

		expect(changed.receiptHash).not.toBe(original.receiptHash);
		expect(changed.receipt.minutes).toBe(120);
	});

	it("builds a signed memo transaction with its deterministic reference", async () => {
		const receipt = await buildAuditReceipt(exchange);
		const authority = Keypair.fromSeed(
			Uint8Array.from({ length: 32 }, () => 7),
		);
		const blockhash = Keypair.fromSeed(
			Uint8Array.from({ length: 32 }, () => 9),
		).publicKey.toBase58();
		const signed = await createSignedAuditTransaction({
			memo: receipt.memo,
			referenceBytes: receipt.referenceBytes,
			secretKey: authority.secretKey,
			blockhash,
		});
		const decoded = Transaction.from(signed.transaction.serialize());
		const [instruction] = decoded.instructions;

		expect(decoded.verifySignatures()).toBe(true);
		expect(decoded.feePayer?.equals(authority.publicKey)).toBe(true);
		expect(instruction.programId.toBase58()).toBe(
			"MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr",
		);
		expect(instruction.keys[0]).toMatchObject({
			isSigner: true,
			isWritable: true,
		});
		expect(instruction.keys[0].pubkey.equals(authority.publicKey)).toBe(true);
		expect(instruction.keys[1]).toMatchObject({
			isSigner: true,
			isWritable: false,
		});
		expect(instruction.keys[1].pubkey.equals(signed.reference)).toBe(true);
		expect(instruction.data.toString("utf8")).toBe(receipt.memo);
	});

	it("reconciles an existing signed receipt before a retry can republish it", async () => {
		const receipt = await buildAuditReceipt(exchange);
		const authority = Keypair.fromSeed(
			Uint8Array.from({ length: 32 }, () => 7),
		);
		const reference = Keypair.fromSeed(
			Uint8Array.from({ length: 32 }, () => 11),
		).publicKey;
		const connection = {
			getSignaturesForAddress: async () => [
				{ signature: "existing-signature", slot: 456, err: null },
			],
			getParsedTransaction: async () => ({
				meta: { err: null },
				transaction: {
					message: {
						accountKeys: [
							{
								pubkey: authority.publicKey,
								signer: true,
								writable: true,
							},
						],
						instructions: [
							{
								program: "spl-memo",
								programId: authority.publicKey,
								parsed: receipt.memo,
							},
						],
					},
				},
			}),
		} as unknown as Connection;

		await expect(
			findExistingReceipt({
				connection,
				reference,
				authority: authority.publicKey,
				memo: receipt.memo,
			}),
		).resolves.toEqual({
			signature: "existing-signature",
			slot: 456,
		});
		await expect(
			findExistingReceipt({
				connection,
				reference,
				authority: authority.publicKey,
				memo: `${receipt.memo}-different`,
			}),
		).resolves.toBeNull();
	});
});

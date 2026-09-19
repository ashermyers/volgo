import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import SolanaAuditStatus from "#/components/solana-audit-status";
import type { SolanaAudit } from "#/features/community/schema";

const confirmedAudit: SolanaAudit = {
	status: "confirmed",
	network: "devnet",
	receiptId: "receipt-id",
	receiptHash: "a".repeat(64),
	authority: "authority",
	signature: "signature",
	slot: 123,
	explorerUrl: "https://explorer.solana.com/tx/signature?cluster=devnet",
};

describe("SolanaAuditStatus", () => {
	it("renders independently verifiable receipt evidence", () => {
		const html = renderToStaticMarkup(
			<SolanaAuditStatus
				audit={confirmedAudit}
				busy={false}
				onRetry={() => undefined}
			/>,
		);

		expect(html).toContain("Audited on Solana devnet");
		expect(html).toContain("Receipt aaaaaaaaaaaaaaaa");
		expect(html).toContain("Audit details");
		expect(html).toContain(confirmedAudit.receiptHash);
		expect(html).toContain("signature");
		expect(html).toContain("authority");
		expect(html).toContain("123");
		expect(html).toContain(confirmedAudit.explorerUrl);
		expect(html).toContain('target="_blank"');
	});

	it("renders a recovery action when publishing is unavailable", () => {
		const html = renderToStaticMarkup(
			<SolanaAuditStatus
				audit={{ ...confirmedAudit, status: "unconfigured" }}
				busy={false}
				onRetry={() => undefined}
			/>,
		);

		expect(html).toContain("awaiting network setup");
		expect(html).toContain("Check Solana setup");
	});
});

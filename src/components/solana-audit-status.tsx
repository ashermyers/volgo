import { ExternalLink, RefreshCw } from "lucide-react";

import { Button } from "#/components/ui/button";
import type { SolanaAudit } from "#/features/community/schema";

export default function SolanaAuditStatus({
	audit,
	busy,
	onRetry,
}: {
	audit: SolanaAudit | null;
	busy: boolean;
	onRetry: () => void;
}) {
	if (audit?.status === "confirmed") {
		return (
			<div className="rounded-xl border border-primary/20 bg-primary/5 p-3">
				<div className="flex items-center justify-between gap-3">
					<div>
						<p className="text-xs font-semibold text-primary">
							Audited on Solana {audit.network}
						</p>
						<p className="mt-1 font-mono text-[11px] text-muted-foreground">
							Receipt {audit.receiptHash.slice(0, 16)}…
						</p>
					</div>
					{audit.explorerUrl ? (
						<Button
							size="sm"
							variant="outline"
							render={
								<a
									href={audit.explorerUrl}
									target="_blank"
									rel="noreferrer"
									aria-label="Open this audit receipt in Solana Explorer"
								>
									Explorer
									<ExternalLink className="size-3.5" />
								</a>
							}
							nativeButton={false}
							className="gap-1.5"
						/>
					) : null}
				</div>
				<details className="mt-3 border-t border-primary/15 pt-2 text-[11px] text-muted-foreground">
					<summary className="cursor-pointer font-medium text-foreground">
						Audit details
					</summary>
					<dl className="mt-2 space-y-2">
						<div>
							<dt>Receipt hash</dt>
							<dd className="break-all font-mono text-foreground">
								{audit.receiptHash}
							</dd>
						</div>
						{audit.signature ? (
							<div>
								<dt>Transaction signature</dt>
								<dd className="break-all font-mono text-foreground">
									{audit.signature}
								</dd>
							</div>
						) : null}
						{audit.authority ? (
							<div>
								<dt>Signing authority</dt>
								<dd className="break-all font-mono text-foreground">
									{audit.authority}
								</dd>
							</div>
						) : null}
						{audit.slot !== null ? (
							<div className="flex gap-2">
								<dt>Confirmed slot</dt>
								<dd className="font-mono text-foreground">{audit.slot}</dd>
							</div>
						) : null}
					</dl>
				</details>
			</div>
		);
	}

	if (
		audit?.status === "pending" ||
		audit?.status === "submitting" ||
		audit?.status === "submitted"
	) {
		return (
			<div className="flex items-center justify-between gap-3 rounded-xl bg-muted px-3 py-2">
				<div className="flex items-center gap-2 text-xs text-muted-foreground">
					<RefreshCw className="size-3.5 animate-spin" />
					Publishing the audit receipt to Solana…
				</div>
				<Button size="sm" variant="ghost" disabled={busy} onClick={onRetry}>
					Check status
				</Button>
			</div>
		);
	}

	const unconfigured = audit?.status === "unconfigured";
	return (
		<div className="rounded-xl border bg-muted/30 p-3">
			<p className="text-xs text-muted-foreground">
				{unconfigured
					? "Hours are verified. Solana audit publishing is awaiting network setup."
					: "Hours are verified, but the Solana receipt still needs to be published."}
			</p>
			<Button
				size="sm"
				variant="outline"
				className="mt-2 gap-1.5"
				disabled={busy}
				onClick={onRetry}
			>
				<RefreshCw className="size-3.5" />
				{busy
					? "Publishing…"
					: unconfigured
						? "Check Solana setup"
						: "Retry Solana audit"}
			</Button>
		</div>
	);
}

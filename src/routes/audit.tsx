import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Clock3, Search, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { z } from "zod";

import AppShell from "#/components/app-shell";
import PageHeader from "#/components/page-header";
import PagePending from "#/components/page-pending";
import SolanaAuditStatus from "#/components/solana-audit-status";
import { Badge } from "#/components/ui/badge";
import { Button } from "#/components/ui/button";
import { Input } from "#/components/ui/input";
import { getPublicAuditReceiptFn } from "#/server/community";

const auditSearchSchema = z.object({
	receipt: z.string().catch("").default(""),
});

export const Route = createFileRoute("/audit")({
	validateSearch: (search) => auditSearchSchema.parse(search),
	loaderDeps: ({ search }) => ({ receipt: search.receipt }),
	loader: ({ deps }) =>
		getPublicAuditReceiptFn({
			data: { receipt: deps.receipt || undefined },
		}),
	pendingComponent: () => <PagePending cards={1} />,
	component: AuditPage,
});

function formatHours(minutes: number) {
	if (minutes < 60) return `${minutes} verified minutes`;
	const hours = minutes / 60;
	return `${hours.toFixed(hours >= 10 ? 0 : 1)} verified hours`;
}

function AuditPage() {
	const data = Route.useLoaderData();
	const search = Route.useSearch();
	const navigate = useNavigate();
	const [receipt, setReceipt] = useState(search.receipt);

	function submit(event: React.FormEvent<HTMLFormElement>) {
		event.preventDefault();
		const value = receipt.trim();
		void navigate({
			to: "/audit",
			search: { receipt: value },
		});
	}

	return (
		<AppShell>
			<main className="mx-auto w-full max-w-3xl px-6 py-12 sm:py-16">
				<PageHeader
					kicker="Public verification"
					title="Verify volunteer hours"
					description="Look up a VOLGO receipt without revealing either participant’s identity, contact details, or post."
				/>

				<section className="mt-8 rounded-2xl border bg-card p-5">
					<div className="flex flex-wrap items-center justify-between gap-3">
						<div className="flex items-center gap-3">
							<div className="flex size-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
								<ShieldCheck className="size-4" />
							</div>
							<div>
								<p className="text-sm font-semibold">Solana audit network</p>
								<p className="text-xs text-muted-foreground">
									{data.config.network}
								</p>
							</div>
						</div>
						<Badge variant={data.config.configured ? "default" : "secondary"}>
							{data.config.configured ? "Publishing enabled" : "Setup pending"}
						</Badge>
					</div>
					{data.config.authority ? (
						<div className="mt-4 border-t pt-3">
							<p className="text-xs text-muted-foreground">Signing authority</p>
							<p className="mt-1 break-all font-mono text-xs">
								{data.config.authority}
							</p>
						</div>
					) : null}
				</section>

				<form onSubmit={submit} className="mt-6 rounded-2xl border bg-card p-5">
					<label htmlFor="audit-receipt" className="text-sm font-medium">
						Receipt ID, receipt hash, or transaction signature
					</label>
					<div className="mt-3 flex flex-col gap-2 sm:flex-row">
						<Input
							id="audit-receipt"
							value={receipt}
							onChange={(event) => setReceipt(event.target.value)}
							placeholder="Paste audit evidence"
							className="font-mono text-xs"
						/>
						<Button type="submit" className="gap-2">
							<Search className="size-4" />
							Verify
						</Button>
					</div>
				</form>

				{data.receipt ? (
					<section className="mt-6 space-y-4 rounded-2xl border bg-card p-5">
						<div className="flex flex-wrap items-center justify-between gap-3">
							<div>
								<p className="text-xs font-medium uppercase tracking-wider text-primary">
									Verified by both participants
								</p>
								<p className="mt-1 flex items-center gap-2 text-lg font-semibold">
									<Clock3 className="size-4" />
									{formatHours(data.receipt.minutes)}
								</p>
							</div>
							<p className="text-xs text-muted-foreground">
								Completed{" "}
								{new Date(data.receipt.completedAt).toLocaleDateString()}
							</p>
						</div>
						<SolanaAuditStatus
							audit={data.receipt.audit}
							busy={false}
							onRetry={() => undefined}
						/>
					</section>
				) : data.searched ? (
					<div className="mt-6 rounded-2xl border border-dashed p-8 text-center">
						<p className="font-medium">No confirmed receipt found</p>
						<p className="mt-2 text-sm text-muted-foreground">
							Check the value and make sure the Solana transaction has
							confirmed.
						</p>
					</div>
				) : (
					<p className="mt-6 text-center text-sm text-muted-foreground">
						Only completion time, duration, and one-way participant commitments
						are recorded on-chain.
					</p>
				)}
			</main>
		</AppShell>
	);
}

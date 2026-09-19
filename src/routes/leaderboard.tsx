import { createFileRoute, Link } from "@tanstack/react-router";
import { Clock3, Medal, Trophy } from "lucide-react";
import { motion } from "motion/react";

import AppShell from "#/components/app-shell";
import { EmptyState } from "#/components/opportunity-card";
import PageError from "#/components/page-error";
import PageHeader from "#/components/page-header";
import PagePending from "#/components/page-pending";
import PaginationControls from "#/components/pagination-controls";
import { Badge } from "#/components/ui/badge";
import { Button } from "#/components/ui/button";
import type { LeaderboardEntry } from "#/features/community/schema";
import { getLeaderboardFn } from "#/server/community";

export const Route = createFileRoute("/leaderboard")({
	validateSearch: (search: Record<string, unknown>): { page?: number } => {
		const page = Number(search.page);
		return {
			page: Number.isInteger(page) && page > 0 ? page : undefined,
		};
	},
	loaderDeps: ({ search }) => ({ page: search.page ?? 1 }),
	loader: ({ deps }) =>
		getLeaderboardFn({ data: { page: deps.page, pageSize: 10 } }),
	pendingComponent: () => <PagePending cards={3} />,
	errorComponent: PageError,
	component: LeaderboardPage,
});

function formatTime(minutes: number) {
	if (minutes < 60) return `${minutes} min`;
	const hours = minutes / 60;
	return `${hours.toFixed(hours >= 10 ? 0 : 1)} hrs`;
}

function rankStyle(rank: number) {
	if (rank === 1) return "bg-amber-400/15 text-amber-500";
	if (rank === 2) return "bg-slate-400/15 text-slate-400";
	if (rank === 3) return "bg-orange-500/15 text-orange-500";
	return "bg-muted text-muted-foreground";
}

function LeaderboardPage() {
	const { entries, pagination } = Route.useLoaderData();
	const navigate = Route.useNavigate();

	return (
		<AppShell>
			<main className="mx-auto w-full max-w-4xl px-6 py-12 sm:py-16">
				<PageHeader
					kicker="Ut Prosim in action"
					title="Top volunteers"
					description="A celebration of time given and verified by both people — never just promises or posts."
					actions={
						<Button render={<Link to="/" />} nativeButton={false}>
							Offer your time
						</Button>
					}
				/>

				{entries.length > 0 ? (
					<div className="mt-10 space-y-3">
						{entries.map((entry, index) => (
							<LeaderboardRow key={entry.userId} entry={entry} index={index} />
						))}
						<p className="pt-3 text-center text-xs text-muted-foreground">
							Rankings use only service time confirmed by both participants.
						</p>
						<PaginationControls
							page={pagination.page}
							totalPages={pagination.totalPages}
							totalItems={pagination.totalItems}
							itemLabel="volunteers"
							onPageChange={(page) =>
								void navigate({ to: "/leaderboard", search: { page } })
							}
						/>
					</div>
				) : (
					<div className="mt-12">
						<EmptyState
							title="The first verified hours are still ahead"
							description="Once both people confirm a completed exchange, volunteer time will appear here."
							action={
								<Button
									render={<Link to="/" />}
									nativeButton={false}
									className="mt-5"
								>
									Be the first to help
								</Button>
							}
						/>
					</div>
				)}
			</main>
		</AppShell>
	);
}

function LeaderboardRow({
	entry,
	index,
}: {
	entry: LeaderboardEntry;
	index: number;
}) {
	return (
		<motion.div
			initial={{ opacity: 0, y: 8 }}
			animate={{ opacity: 1, y: 0 }}
			transition={{ delay: index * 0.04 }}
		>
			<Link
				to="/users/$userId"
				params={{ userId: entry.userId }}
				className="flex flex-col gap-4 rounded-2xl border bg-card p-4 transition-colors hover:bg-muted/30 sm:flex-row sm:items-center"
			>
				<div
					className={`flex size-11 shrink-0 items-center justify-center rounded-xl font-heading text-lg font-semibold ${rankStyle(entry.rank)}`}
				>
					{entry.rank <= 3 ? (
						entry.rank === 1 ? (
							<Trophy className="size-5" aria-label="First place" />
						) : (
							<Medal className="size-5" aria-label={`Rank ${entry.rank}`} />
						)
					) : (
						entry.rank
					)}
				</div>

				<div className="min-w-0 flex-1">
					<p className="font-semibold">{entry.displayName}</p>
					<p className="mt-1 text-xs text-muted-foreground">
						{entry.exchanges} verified{" "}
						{entry.exchanges === 1 ? "exchange" : "exchanges"}
					</p>
					{entry.skills.length > 0 ? (
						<div className="mt-2 flex flex-wrap gap-1.5">
							{entry.skills.map((skill) => (
								<Badge key={skill} variant="secondary">
									{skill}
								</Badge>
							))}
						</div>
					) : null}
				</div>

				<div className="flex shrink-0 items-center gap-2 rounded-xl bg-primary/10 px-3 py-2 text-sm font-medium text-primary">
					<Clock3 className="size-4" />
					{formatTime(entry.verifiedMinutes)}
				</div>
			</Link>
		</motion.div>
	);
}

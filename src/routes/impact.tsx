import { createFileRoute, Link } from "@tanstack/react-router";
import { Clock3, HeartHandshake, Sparkles, Users } from "lucide-react";
import { motion } from "motion/react";
import type { ReactNode } from "react";

import AppShell from "#/components/app-shell";
import OpportunityCard, {
	EmptyState,
	SignInPrompt,
} from "#/components/opportunity-card";
import PageHeader from "#/components/page-header";
import PagePending from "#/components/page-pending";
import { Badge } from "#/components/ui/badge";
import { Button } from "#/components/ui/button";
import { getImpactFn } from "#/server/community";

export const Route = createFileRoute("/impact")({
	loader: () => getImpactFn(),
	pendingComponent: () => <PagePending cards={2} />,
	component: ImpactPage,
});

function formatHours(minutes: number) {
	if (minutes < 60) return `${minutes} min`;
	const hours = minutes / 60;
	return `${hours.toFixed(hours >= 10 ? 0 : 1)} hrs`;
}

function ImpactPage() {
	const data = Route.useLoaderData();

	return (
		<AppShell>
			<main className="mx-auto w-full max-w-5xl px-6 py-12 sm:py-16">
				<PageHeader
					kicker="Ut Prosim"
					title="Your impact"
					description="A quiet record of time offered, people reached, and skills you’ve put in service of others."
				/>

				{!data.isAuthenticated ? (
					<div className="mt-12">
						<SignInPrompt />
					</div>
				) : (
					<>
						<div className="mt-10 grid gap-4 sm:grid-cols-3">
							<StatCard
								icon={<Clock3 className="size-4" />}
								label="Time pledged"
								value={formatHours(data.minutesPledged)}
								hint="From the offers and requests you’ve posted"
								index={0}
							/>
							<StatCard
								icon={<Users className="size-4" />}
								label="People reached"
								value={String(data.peopleReached)}
								hint="Neighbors you’ve asked to help, or offered to help"
								index={1}
							/>
							<StatCard
								icon={<HeartHandshake className="size-4" />}
								label="Posts"
								value={String(data.posts)}
								hint="Help asked for and time offered"
								index={2}
							/>
						</div>

						<section className="mt-10 rounded-2xl border bg-card p-6">
							<div className="flex items-center gap-2 text-sm font-medium">
								<Sparkles className="size-4 text-primary" />
								Skills in motion
							</div>
							{data.skills.length > 0 ? (
								<div className="mt-4 flex flex-wrap gap-2">
									{data.skills.map((skill) => (
										<Badge key={skill} variant="secondary">
											{skill}
										</Badge>
									))}
								</div>
							) : (
								<p className="mt-3 text-sm text-muted-foreground">
									Post an offer or request and the skills you serve with will
									appear here.
								</p>
							)}
							<p className="mt-5 text-xs leading-5 text-muted-foreground">
								Verified hours will be sealed later as proof of service. For now
								this page is your living ledger — no tokens, just time given.
							</p>
						</section>

						<section className="mt-10">
							<div className="mb-4 flex items-end justify-between gap-4">
								<h2 className="text-lg font-semibold tracking-tight">
									Recent activity
								</h2>
								<Button
									render={<Link to="/requests" />}
									nativeButton={false}
									variant="ghost"
									size="sm"
								>
									View all
								</Button>
							</div>

							{data.recent.length > 0 ? (
								<div className="grid gap-4 md:grid-cols-2">
									{data.recent.map((item, index) => (
										<OpportunityCard key={item.id} item={item} index={index} />
									))}
								</div>
							) : (
								<EmptyState
									title="No hours recorded yet"
									description="Share what you can do, or what you need. Impact grows from those first posts."
									action={
										<Button
											render={<Link to="/" />}
											nativeButton={false}
											className="mt-5"
										>
											Start on the home page
										</Button>
									}
								/>
							)}
						</section>
					</>
				)}
			</main>
		</AppShell>
	);
}

function StatCard({
	icon,
	label,
	value,
	hint,
	index = 0,
}: {
	icon: ReactNode;
	label: string;
	value: string;
	hint: string;
	index?: number;
}) {
	return (
		<motion.div
			initial={{ opacity: 0, y: 10 }}
			animate={{ opacity: 1, y: 0 }}
			transition={{ delay: index * 0.06 }}
			className="rounded-2xl border bg-card p-5"
		>
			<div className="flex items-center gap-2 text-sm text-muted-foreground">
				<span className="flex size-8 items-center justify-center rounded-lg bg-muted text-foreground">
					{icon}
				</span>
				{label}
			</div>
			<p className="mt-4 font-heading text-3xl font-semibold tracking-tight">
				{value}
			</p>
			<p className="mt-1 text-xs leading-5 text-muted-foreground">{hint}</p>
		</motion.div>
	);
}

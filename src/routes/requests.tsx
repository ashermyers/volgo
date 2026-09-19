import { createFileRoute, Link } from "@tanstack/react-router";
import {
	ArrowRight,
	CalendarClock,
	Clock3,
	HandHeart,
	HelpingHand,
	Inbox,
	Plus,
} from "lucide-react";
import { motion } from "motion/react";
import { useState } from "react";

import Navigation from "#/components/navigation";
import { Badge } from "#/components/ui/badge";
import { Button } from "#/components/ui/button";
import type { IntentListItem } from "#/features/intents/schema";
import { getMyIntentsFn } from "#/server/intents";

export const Route = createFileRoute("/requests")({
	loader: () => getMyIntentsFn(),
	component: RequestsPage,
});

type Filter = "all" | "request" | "offer";

const filterLabels: Array<{ value: Filter; label: string }> = [
	{ value: "all", label: "All activity" },
	{ value: "request", label: "Help I need" },
	{ value: "offer", label: "Help I offered" },
];

function formatDate(value: string) {
	return new Intl.DateTimeFormat("en-US", {
		month: "short",
		day: "numeric",
		year: "numeric",
	}).format(new Date(value));
}

function ActivityCard({
	item,
	index,
}: {
	item: IntentListItem;
	index: number;
}) {
	const isOffer = item.type === "offer";

	return (
		<motion.article
			initial={{ opacity: 0, y: 12 }}
			animate={{ opacity: 1, y: 0 }}
			transition={{ delay: Math.min(index * 0.05, 0.25) }}
			className="group rounded-2xl border bg-card p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
		>
			<div className="flex items-start justify-between gap-4">
				<div className="flex min-w-0 items-start gap-3">
					<div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
						{isOffer ? (
							<HandHeart className="size-5" />
						) : (
							<HelpingHand className="size-5" />
						)}
					</div>
					<div className="min-w-0">
						<p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
							{isOffer ? "I can help" : "I need help"}
						</p>
						<h2 className="mt-1 text-lg font-semibold tracking-tight">
							{item.title}
						</h2>
					</div>
				</div>
				<Badge variant={item.status === "completed" ? "secondary" : "outline"}>
					<span className="capitalize">{item.status}</span>
				</Badge>
			</div>

			<p className="mt-4 text-sm leading-6 text-muted-foreground">
				{item.description}
			</p>

			<div className="mt-4 flex flex-wrap gap-2">
				{item.skills.map((skill) => (
					<Badge key={skill} variant="secondary">
						{skill}
					</Badge>
				))}
			</div>

			<div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2 border-t pt-4 text-xs text-muted-foreground">
				{item.minutes ? (
					<span className="flex items-center gap-1.5">
						<Clock3 className="size-3.5" />
						{item.minutes} minutes
					</span>
				) : null}
				{item.availability ? (
					<span className="flex items-center gap-1.5">
						<CalendarClock className="size-3.5" />
						{item.availability}
					</span>
				) : null}
				<span className="ml-auto">Posted {formatDate(item.createdAt)}</span>
			</div>
		</motion.article>
	);
}

function RequestsPage() {
	const { isAuthenticated, items } = Route.useLoaderData();
	const [filter, setFilter] = useState<Filter>("all");
	const filteredItems =
		filter === "all" ? items : items.filter((item) => item.type === filter);

	return (
		<div className="min-h-screen bg-background text-foreground">
			<Navigation />

			<main className="mx-auto w-full max-w-5xl px-6 py-12 sm:py-16">
				<div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
					<div>
						<p className="text-sm font-medium text-primary">
							Your community activity
						</p>
						<h1 className="mt-2 font-heading text-3xl font-semibold tracking-tight sm:text-4xl">
							Requests & offers
						</h1>
						<p className="mt-2 max-w-xl text-muted-foreground">
							Keep track of the help you need and the time you’ve offered.
						</p>
					</div>
					<Button
						render={<Link to="/" />}
						nativeButton={false}
						className="gap-2 self-start sm:self-auto"
					>
						<Plus className="size-4" />
						Create a post
					</Button>
				</div>

				{!isAuthenticated ? (
					<div className="mt-12 flex flex-col items-center rounded-2xl border border-dashed px-6 py-16 text-center">
						<div className="flex size-12 items-center justify-center rounded-2xl bg-muted">
							<Inbox className="size-5 text-muted-foreground" />
						</div>
						<h2 className="mt-5 text-lg font-semibold">
							Sign in to see your activity
						</h2>
						<p className="mt-2 max-w-sm text-sm text-muted-foreground">
							Your requests and offers are private to your account until you
							choose to share them with the community.
						</p>
						<Button
							render={<Link to="/login" />}
							nativeButton={false}
							className="mt-5 gap-2"
						>
							Sign in
							<ArrowRight className="size-4" />
						</Button>
					</div>
				) : (
					<>
						<div className="mt-10 flex gap-1 overflow-x-auto rounded-xl border bg-muted/40 p-1 sm:w-fit">
							{filterLabels.map((option) => (
								<Button
									key={option.value}
									variant={filter === option.value ? "secondary" : "ghost"}
									className={
										filter === option.value
											? "bg-background shadow-sm"
											: "text-muted-foreground"
									}
									onClick={() => setFilter(option.value)}
								>
									{option.label}
								</Button>
							))}
						</div>

						{filteredItems.length > 0 ? (
							<div className="mt-6 grid gap-4 md:grid-cols-2">
								{filteredItems.map((item, index) => (
									<ActivityCard key={item.id} item={item} index={index} />
								))}
							</div>
						) : (
							<motion.div
								initial={{ opacity: 0 }}
								animate={{ opacity: 1 }}
								className="mt-6 flex flex-col items-center rounded-2xl border border-dashed px-6 py-16 text-center"
							>
								<div className="flex size-12 items-center justify-center rounded-2xl bg-muted">
									<Inbox className="size-5 text-muted-foreground" />
								</div>
								<h2 className="mt-5 text-lg font-semibold">
									{items.length === 0
										? "Nothing here yet"
										: "No posts in this view"}
								</h2>
								<p className="mt-2 max-w-sm text-sm text-muted-foreground">
									{items.length === 0
										? "Describe what you need or what you can offer. VOLGO will turn it into a community-ready post."
										: "Try another filter to see the rest of your activity."}
								</p>
								{items.length === 0 ? (
									<Button
										render={<Link to="/" />}
										nativeButton={false}
										className="mt-5 gap-2"
									>
										Create your first post
										<ArrowRight className="size-4" />
									</Button>
								) : null}
							</motion.div>
						)}
					</>
				)}
			</main>
		</div>
	);
}

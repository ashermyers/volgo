import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Check, Compass, Sparkles } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useMemo, useState } from "react";

import AppShell from "#/components/app-shell";
import OpportunityCard, { EmptyState } from "#/components/opportunity-card";
import PageHeader from "#/components/page-header";
import PagePending from "#/components/page-pending";
import SegmentedControl from "#/components/segmented-control";
import { Button } from "#/components/ui/button";
import type { CommunityPost } from "#/features/community/schema";
import { expressInterestFn, getDiscoverFeedFn } from "#/server/community";

export const Route = createFileRoute("/discover")({
	loader: () => getDiscoverFeedFn(),
	pendingComponent: () => <PagePending />,
	component: DiscoverPage,
});

type Filter = "for-you" | "request" | "offer" | "all";

const filters: Array<{ value: Filter; label: string }> = [
	{ value: "for-you", label: "For you" },
	{ value: "request", label: "Needs help" },
	{ value: "offer", label: "Can help" },
	{ value: "all", label: "Everyone" },
];

function DiscoverPage() {
	const { isAuthenticated, items, hasProfileSignal } = Route.useLoaderData();
	const navigate = useNavigate();
	const [filter, setFilter] = useState<Filter>(
		hasProfileSignal ? "for-you" : "all",
	);
	const [busyId, setBusyId] = useState<string | null>(null);
	const [sentIds, setSentIds] = useState<Set<string>>(
		() =>
			new Set(
				items.filter((item) => item.expressedInterest).map((item) => item.id),
			),
	);
	const [error, setError] = useState<string | null>(null);

	const filteredItems = useMemo(() => {
		return items.filter((item) => {
			if (filter === "all") return true;
			if (filter === "request" || filter === "offer")
				return item.type === filter;
			return (item.matchScore ?? 0) >= 40;
		});
	}, [filter, items]);

	const featured = filteredItems
		.filter((item) => (item.matchScore ?? 0) >= 55 && !sentIds.has(item.id))
		.slice(0, 2);
	const featuredIds = new Set(featured.map((item) => item.id));
	const rest = filteredItems.filter((item) => !featuredIds.has(item.id));

	async function sendInterest(item: CommunityPost) {
		if (!isAuthenticated) {
			await navigate({ to: "/login" });
			return;
		}

		if (sentIds.has(item.id) || busyId) return;

		setError(null);
		setBusyId(item.id);

		try {
			await expressInterestFn({
				data: { postId: item.id, postType: item.type },
			});
			setSentIds((current) => new Set(current).add(item.id));
		} catch (caughtError) {
			setError(
				caughtError instanceof Error &&
					caughtError.message.toLowerCase().includes("signed in")
					? "Please sign in before continuing."
					: "We couldn't send that yet. Please try again.",
			);
		} finally {
			setBusyId(null);
		}
	}

	return (
		<AppShell>
			<main className="mx-auto w-full max-w-5xl px-6 py-12 sm:py-16">
				<PageHeader
					kicker="The community board"
					title="Discover who needs you"
					description="Browse open requests and offers. VOLGO quietly ranks the ones that fit the skills you’ve already shared."
					actions={
						<Button
							render={<Link to="/" />}
							nativeButton={false}
							className="gap-2 self-start sm:self-auto"
						>
							<Sparkles className="size-4" />
							Post something
						</Button>
					}
				/>

				<div className="mt-10">
					<SegmentedControl
						layoutId="discover-filter"
						value={filter}
						onChange={setFilter}
						options={filters}
					/>
				</div>

				{error ? (
					<p className="mt-4 text-sm text-destructive" role="alert">
						{error}
					</p>
				) : null}

				{items.length === 0 ? (
					<div className="mt-8">
						<EmptyState
							title="The board is still quiet"
							description="Be the first to post. Once a few people share what they need or can offer, matches will appear here."
							action={
								<Button
									render={<Link to="/" />}
									nativeButton={false}
									className="mt-5"
								>
									Create a post
								</Button>
							}
						/>
					</div>
				) : filteredItems.length === 0 ? (
					<div className="mt-8">
						<EmptyState
							title="No matches in this view"
							description={
								hasProfileSignal
									? "Try Everyone, or post a clearer offer so VOLGO has more to work with."
									: "Post what you can help with — then For you will have something to rank."
							}
							action={
								<Button
									render={<Link to="/" />}
									nativeButton={false}
									className="mt-5"
								>
									Add an offer or request
								</Button>
							}
						/>
					</div>
				) : (
					<div className="mt-8 space-y-10">
						{featured.length > 0 ? (
							<section>
								<div className="mb-4 flex items-center gap-2 text-sm font-medium">
									<Compass className="size-4 text-primary" />
									Best fits right now
								</div>
								<div className="grid gap-4 lg:grid-cols-2">
									<AnimatePresence mode="popLayout">
										{featured.map((item, index) => (
											<OpportunityCard
												key={item.id}
												item={item}
												index={index}
												featured
												person={item.displayName}
												personHref={item.userId}
												matchScore={item.matchScore}
												matchExplanation={item.matchExplanation}
												footer={
													<InterestButton
														item={item}
														busy={busyId === item.id}
														sent={sentIds.has(item.id)}
														onClick={() => void sendInterest(item)}
													/>
												}
											/>
										))}
									</AnimatePresence>
								</div>
							</section>
						) : null}

						<section>
							{featured.length > 0 ? (
								<div className="mb-4 text-sm font-medium text-muted-foreground">
									More in the community
								</div>
							) : null}
							<div className="grid gap-4 md:grid-cols-2">
								<AnimatePresence mode="popLayout">
									{rest.map((item, index) => (
										<OpportunityCard
											key={item.id}
											item={item}
											index={index}
											person={item.displayName}
											personHref={item.userId}
											matchScore={item.matchScore}
											matchExplanation={item.matchExplanation}
											footer={
												<InterestButton
													item={item}
													busy={busyId === item.id}
													sent={sentIds.has(item.id)}
													onClick={() => void sendInterest(item)}
												/>
											}
										/>
									))}
								</AnimatePresence>
							</div>
						</section>
					</div>
				)}
			</main>
		</AppShell>
	);
}

function InterestButton({
	item,
	busy,
	sent,
	onClick,
}: {
	item: CommunityPost;
	busy: boolean;
	sent: boolean;
	onClick: () => void;
}) {
	return (
		<motion.div layout>
			<Button
				className="w-full gap-2"
				variant={sent ? "secondary" : "default"}
				disabled={busy || sent}
				onClick={onClick}
			>
				{sent ? (
					<>
						<Check className="size-4" />
						Interest sent
					</>
				) : busy ? (
					"Sending…"
				) : item.type === "request" ? (
					"I can help"
				) : (
					"I could use this"
				)}
			</Button>
		</motion.div>
	);
}

import {
	createFileRoute,
	Link,
	useNavigate,
	useRouter,
} from "@tanstack/react-router";
import { Check, Compass, Sparkles } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";

import AppShell from "#/components/app-shell";
import OpportunityCard, { EmptyState } from "#/components/opportunity-card";
import PageError from "#/components/page-error";
import PageHeader from "#/components/page-header";
import PagePending from "#/components/page-pending";
import PaginationControls from "#/components/pagination-controls";
import SegmentedControl from "#/components/segmented-control";
import { Button } from "#/components/ui/button";
import type { CommunityPost } from "#/features/community/schema";
import { notifyToast } from "#/lib/notify-toast";
import {
	expressInterestFn,
	getDiscoverFeedFn,
	withdrawInterestFn,
} from "#/server/community";

export const Route = createFileRoute("/discover")({
	validateSearch: (
		search: Record<string, unknown>,
	): { filter?: Filter; page?: number } => {
		const page = Number(search.page);
		return {
			filter:
				search.filter === "for-you" ||
				search.filter === "request" ||
				search.filter === "offer" ||
				search.filter === "all"
					? search.filter
					: undefined,
			page: Number.isInteger(page) && page > 0 ? page : undefined,
		};
	},
	loaderDeps: ({ search }) => ({
		filter: search.filter ?? "for-you",
		page: search.page ?? 1,
	}),
	loader: ({ deps }) =>
		getDiscoverFeedFn({
			data: { filter: deps.filter, page: deps.page, pageSize: 12 },
		}),
	pendingComponent: () => <PagePending />,
	errorComponent: PageError,
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
	const { isAuthenticated, items, hasProfileSignal, pagination } =
		Route.useLoaderData();
	const search = Route.useSearch();
	const navigate = useNavigate();
	const router = useRouter();
	const filter: Filter =
		search.filter ?? (hasProfileSignal ? "for-you" : "all");
	const [busyId, setBusyId] = useState<string | null>(null);
	const [sentOverride, setSentOverride] = useState<Record<string, boolean>>({});
	const [error, setError] = useState<string | null>(null);

	function isSent(item: CommunityPost) {
		return sentOverride[item.id] ?? item.expressedInterest;
	}

	const featured = items
		.filter((item) => (item.matchScore ?? 0) >= 55 && !isSent(item))
		.slice(0, 2);
	const featuredIds = new Set(featured.map((item) => item.id));
	const rest = items.filter((item) => !featuredIds.has(item.id));

	function changeFilter(nextFilter: Filter) {
		void navigate({
			to: "/discover",
			search: { filter: nextFilter, page: 1 },
		});
	}

	async function sendInterest(item: CommunityPost) {
		if (!isAuthenticated) {
			await navigate({ to: "/login" });
			return;
		}

		if (isSent(item) || busyId) return;

		setError(null);
		setBusyId(item.id);

		try {
			const result = await expressInterestFn({
				data: { postId: item.id, postType: item.type },
			});
			setSentOverride((current) => ({ ...current, [item.id]: true }));
			notifyToast({
				title: result.alreadySent
					? "Already sent"
					: item.type === "request"
						? "Help offered"
						: "Interest sent",
				description: result.alreadySent
					? "They already have your reply."
					: `We’ll notify them about “${item.title}”.`,
			});
			await router.invalidate();
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

	async function withdrawInterest(item: CommunityPost) {
		if (busyId) return;
		setError(null);
		setBusyId(item.id);
		try {
			await withdrawInterestFn({
				data: { postId: item.id, postType: item.type },
			});
			setSentOverride((current) => ({ ...current, [item.id]: false }));
			notifyToast({
				title: "Reply withdrawn",
				description: `You can send interest again if “${item.title}” is still open.`,
			});
			await router.invalidate();
		} catch {
			setError("We couldn't withdraw that yet. Please try again.");
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
						onChange={changeFilter}
						options={filters}
					/>
				</div>

				{error ? (
					<p className="mt-4 text-sm text-destructive" role="alert">
						{error}
					</p>
				) : null}

				{pagination.totalItems === 0 ? (
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
				) : items.length === 0 ? (
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
														sent={isSent(item)}
														onClick={() => void sendInterest(item)}
														onWithdraw={() => void withdrawInterest(item)}
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
													sent={isSent(item)}
													onClick={() => void sendInterest(item)}
													onWithdraw={() => void withdrawInterest(item)}
												/>
											}
										/>
									))}
								</AnimatePresence>
							</div>
						</section>
					</div>
				)}
				<PaginationControls
					page={pagination.page}
					totalPages={pagination.totalPages}
					totalItems={pagination.totalItems}
					itemLabel="community posts"
					onPageChange={(page) =>
						void navigate({
							to: "/discover",
							search: { filter, page },
						})
					}
				/>
			</main>
		</AppShell>
	);
}

function InterestButton({
	item,
	busy,
	sent,
	onClick,
	onWithdraw,
}: {
	item: CommunityPost;
	busy: boolean;
	sent: boolean;
	onClick: () => void;
	onWithdraw: () => void;
}) {
	if (sent) {
		return (
			<motion.div layout className="grid gap-2">
				<Button className="w-full gap-2" variant="secondary" disabled>
					<Check className="size-4" />
					Interest sent
				</Button>
				<Button
					variant="ghost"
					className="w-full text-muted-foreground"
					disabled={busy}
					onClick={onWithdraw}
				>
					{busy ? "Withdrawing…" : "Withdraw reply"}
				</Button>
			</motion.div>
		);
	}

	return (
		<motion.div layout>
			<Button className="w-full gap-2" disabled={busy} onClick={onClick}>
				{busy
					? "Sending…"
					: item.type === "request"
						? "I can help"
						: "I could use this"}
			</Button>
		</motion.div>
	);
}

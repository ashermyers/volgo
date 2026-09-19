import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import {
	Check,
	Clock3,
	Mail,
	Phone,
	Plus,
	ShieldCheck,
	Sparkles,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useMemo, useState } from "react";

import AppShell from "#/components/app-shell";
import DeletePostButton from "#/components/delete-post-button";
import OpportunityCard, {
	EmptyState,
	SignInPrompt,
} from "#/components/opportunity-card";
import PageHeader from "#/components/page-header";
import PagePending from "#/components/page-pending";
import SegmentedControl from "#/components/segmented-control";
import { Button } from "#/components/ui/button";
import type {
	ActiveConnection,
	BoardItem,
	IncomingInterest,
} from "#/features/community/schema";
import {
	acceptMatchFn,
	completeMatchFn,
	getMyBoardFn,
} from "#/server/community";
import { deleteIntentFn } from "#/server/intents";

export const Route = createFileRoute("/requests")({
	loader: () => getMyBoardFn(),
	pendingComponent: () => <PagePending cards={2} />,
	component: RequestsPage,
});

type Filter = "all" | "request" | "offer";

const filterLabels: Array<{ value: Filter; label: string }> = [
	{ value: "all", label: "All activity" },
	{ value: "request", label: "Help I need" },
	{ value: "offer", label: "Help I offered" },
];

function RequestsPage() {
	const { isAuthenticated, items, incoming, connections } =
		Route.useLoaderData();
	const router = useRouter();
	const [filter, setFilter] = useState<Filter>("all");
	const [busyId, setBusyId] = useState<string | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [acceptedIds, setAcceptedIds] = useState<Set<string>>(new Set());

	const visibleIncoming = useMemo(
		() => incoming.filter((item) => !acceptedIds.has(item.id)),
		[acceptedIds, incoming],
	);

	const filteredItems =
		filter === "all" ? items : items.filter((item) => item.type === filter);

	async function accept(item: IncomingInterest) {
		if (busyId) return;
		setError(null);
		setBusyId(item.id);

		try {
			await acceptMatchFn({ data: { matchId: item.id } });
			setAcceptedIds((current) => new Set(current).add(item.id));
			await router.invalidate();
		} catch {
			setError("We couldn't accept that yet. Please try again.");
		} finally {
			setBusyId(null);
		}
	}

	async function remove(item: BoardItem) {
		if (busyId) return;
		setError(null);
		setBusyId(item.id);

		try {
			await deleteIntentFn({
				data: { postId: item.id, postType: item.type },
			});
			await router.invalidate();
		} catch {
			setError("We couldn't delete that yet. Please try again.");
		} finally {
			setBusyId(null);
		}
	}

	async function complete(connection: ActiveConnection) {
		if (busyId) return;
		setError(null);
		setBusyId(connection.id);

		try {
			await completeMatchFn({ data: { matchId: connection.id } });
			await router.invalidate();
		} catch {
			setError("We couldn't confirm those hours yet. Please try again.");
		} finally {
			setBusyId(null);
		}
	}

	return (
		<AppShell>
			<main className="mx-auto w-full max-w-5xl px-6 py-12 sm:py-16">
				<PageHeader
					kicker="Your community activity"
					title="Requests & offers"
					description="Keep track of the help you need, the time you’ve offered, and the people reaching out."
					actions={
						<Button
							render={<Link to="/" />}
							nativeButton={false}
							className="gap-2 self-start sm:self-auto"
						>
							<Plus className="size-4" />
							Create a post
						</Button>
					}
				/>

				{!isAuthenticated ? (
					<div className="mt-12">
						<SignInPrompt />
					</div>
				) : (
					<>
						{error ? (
							<p className="mt-6 text-sm text-destructive" role="alert">
								{error}
							</p>
						) : null}

						{visibleIncoming.length > 0 ? (
							<section className="mt-10">
								<div className="mb-4 flex items-center gap-2 text-sm font-medium">
									<Sparkles className="size-4 text-primary" />
									People reaching out
								</div>
								<div className="grid gap-3">
									<AnimatePresence mode="popLayout">
										{visibleIncoming.map((item) => (
											<IncomingCard
												key={item.id}
												item={item}
												busy={busyId === item.id}
												onAccept={() => void accept(item)}
											/>
										))}
									</AnimatePresence>
								</div>
							</section>
						) : null}

						{connections.length > 0 ? (
							<section className="mt-10">
								<div className="mb-4 flex items-center gap-2 text-sm font-medium">
									<ShieldCheck className="size-4 text-primary" />
									Accepted matches
								</div>
								<div className="grid gap-4 md:grid-cols-2">
									{connections.map((connection) => (
										<ConnectionCard
											key={connection.id}
											connection={connection}
											busy={busyId === connection.id}
											onConfirm={() => void complete(connection)}
										/>
									))}
								</div>
							</section>
						) : null}

						<div className="mt-10">
							<SegmentedControl
								layoutId="requests-filter"
								value={filter}
								onChange={setFilter}
								options={filterLabels}
							/>
						</div>

						{filteredItems.length > 0 ? (
							<div className="mt-6 grid gap-4 md:grid-cols-2">
								<AnimatePresence mode="popLayout">
									{filteredItems.map((item, index) => {
										const done = item.status === "completed";
										const matched =
											item.status === "matched" ||
											Boolean(item.acceptedMatchId);

										return (
											<OpportunityCard
												key={item.id}
												item={{
													...item,
													status: done
														? "completed"
														: matched
															? "matched"
															: item.status,
												}}
												index={index}
												footer={
													<div className="space-y-3">
														{item.incomingCount > 0 ? (
															<p className="text-xs text-muted-foreground">
																{item.incomingCount}{" "}
																{item.incomingCount === 1
																	? "person is"
																	: "people are"}{" "}
																reaching out
															</p>
														) : null}
														{item.partnerName && matched ? (
															<p className="text-xs text-muted-foreground">
																Matched with {item.partnerName}
															</p>
														) : null}
														{!done ? (
															<DeletePostButton
																busy={busyId === item.id}
																onConfirm={() => void remove(item)}
															/>
														) : null}
													</div>
												}
											/>
										);
									})}
								</AnimatePresence>
							</div>
						) : (
							<div className="mt-6">
								<EmptyState
									title={
										items.length === 0
											? "Nothing here yet"
											: "No posts in this view"
									}
									description={
										items.length === 0
											? "Describe what you need or what you can offer. VOLGO will turn it into a community-ready post."
											: "Try another filter to see the rest of your activity."
									}
									action={
										items.length === 0 ? (
											<Button
												render={<Link to="/" />}
												nativeButton={false}
												className="mt-5 gap-2"
											>
												Create your first post
											</Button>
										) : null
									}
								/>
							</div>
						)}
					</>
				)}
			</main>
		</AppShell>
	);
}

function ConnectionCard({
	connection,
	busy,
	onConfirm,
}: {
	connection: ActiveConnection;
	busy: boolean;
	onConfirm: () => void;
}) {
	const completed = connection.status === "completed";
	const verifiedByBoth =
		completed && connection.youConfirmed && connection.partnerConfirmed;

	return (
		<motion.article layout className="rounded-2xl border bg-card p-5 shadow-sm">
			<div className="flex items-start justify-between gap-4">
				<div>
					<p className="text-xs font-medium uppercase tracking-wider text-primary">
						{connection.role === "provider"
							? "You’re providing help"
							: "You’re receiving help"}
					</p>
					<h2 className="mt-1 text-base font-semibold">
						{connection.postTitle}
					</h2>
					<p className="mt-1 text-sm text-muted-foreground">
						With {connection.partnerName}
					</p>
				</div>
				<div className="flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground">
					<Clock3 className="size-3.5" />
					{connection.minutes} min
				</div>
			</div>

			<div className="mt-4 rounded-xl border bg-muted/30 p-3">
				<p className="mb-2 text-xs font-medium text-muted-foreground">
					Contact shared after acceptance
				</p>
				<div className="flex flex-wrap gap-2">
					{connection.partnerContact.phone ? (
						<a
							href={`tel:${connection.partnerContact.phone}`}
							className="inline-flex items-center gap-2 rounded-lg border bg-background px-3 py-2 text-sm transition-colors hover:bg-muted"
						>
							<Phone className="size-4 text-primary" />
							{connection.partnerContact.phone}
						</a>
					) : null}
					{connection.partnerContact.email ? (
						<a
							href={`mailto:${connection.partnerContact.email}`}
							className="inline-flex items-center gap-2 rounded-lg border bg-background px-3 py-2 text-sm transition-colors hover:bg-muted"
						>
							<Mail className="size-4 text-primary" />
							{connection.partnerContact.email}
						</a>
					) : null}
					{!connection.partnerContact.phone &&
					!connection.partnerContact.email ? (
						<p className="text-sm text-muted-foreground">
							{connection.partnerName} hasn’t added contact details yet.
						</p>
					) : null}
				</div>
			</div>

			<div className="mt-4">
				{verifiedByBoth ? (
					<div className="flex items-center gap-2 text-sm font-medium text-primary">
						<Check className="size-4" />
						Both people verified these hours
					</div>
				) : completed ? (
					<div className="flex items-center gap-2 text-sm text-muted-foreground">
						<Clock3 className="size-4" />
						Completed before two-sided verification
					</div>
				) : connection.youConfirmed ? (
					<div className="rounded-xl bg-muted px-3 py-2 text-sm text-muted-foreground">
						You confirmed the time. Waiting for {connection.partnerName}.
					</div>
				) : (
					<>
						{connection.partnerConfirmed ? (
							<p className="mb-2 text-xs text-muted-foreground">
								{connection.partnerName} already confirmed.
							</p>
						) : null}
						<Button
							className="w-full gap-2"
							disabled={busy}
							onClick={onConfirm}
						>
							<Check className="size-4" />
							{busy
								? "Confirming…"
								: `Confirm ${connection.minutes} minutes completed`}
						</Button>
					</>
				)}
			</div>
		</motion.article>
	);
}

function IncomingCard({
	item,
	busy,
	onAccept,
}: {
	item: IncomingInterest;
	busy: boolean;
	onAccept: () => void;
}) {
	return (
		<motion.article
			layout
			initial={{ opacity: 0, y: 10, scale: 0.98 }}
			animate={{ opacity: 1, y: 0, scale: 1 }}
			exit={{ opacity: 0, x: 24, scale: 0.98 }}
			transition={{ type: "spring", stiffness: 320, damping: 28 }}
			className="flex flex-col gap-4 rounded-2xl border bg-card p-4 sm:flex-row sm:items-center sm:justify-between"
		>
			<div className="min-w-0">
				<p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
					{item.postType === "request" ? "Wants to help" : "Could use this"} ·{" "}
					{item.score} fit
				</p>
				<h2 className="mt-1 truncate text-base font-semibold">
					{item.fromDisplayName}
				</h2>
				<p className="mt-1 truncate text-sm text-muted-foreground">
					{item.postTitle}
					{item.explanation ? ` — ${item.explanation}` : ""}
				</p>
			</div>
			<Button className="shrink-0 gap-2" disabled={busy} onClick={onAccept}>
				{busy ? "Matching…" : "Accept"}
			</Button>
		</motion.article>
	);
}

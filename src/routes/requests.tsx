import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import {
	Archive,
	ArchiveRestore,
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
import ArchivePostButton from "#/components/delete-post-button";
import EditPostDialog from "#/components/edit-post-dialog";
import OpportunityCard, {
	EmptyState,
	SignInPrompt,
} from "#/components/opportunity-card";
import PageError from "#/components/page-error";
import PageHeader from "#/components/page-header";
import PagePending from "#/components/page-pending";
import PaginationControls from "#/components/pagination-controls";
import SegmentedControl from "#/components/segmented-control";
import SolanaAuditStatus from "#/components/solana-audit-status";
import ThankYouDialog from "#/components/thank-you-dialog";
import { Button } from "#/components/ui/button";
import type {
	ActiveConnection,
	BoardItem,
	IncomingInterest,
} from "#/features/community/schema";
import { fireRequestFulfilled, fireThankYou } from "#/lib/celebrations";
import { notifyToast } from "#/lib/notify-toast";
import {
	acceptMatchFn,
	archiveCompletedPostFn,
	completeMatchFn,
	getMyBoardPaginatedFn,
	retrySolanaAuditFn,
	sendThankYouFn,
} from "#/server/community";
import {
	archiveIntentFn,
	restoreIntentFn,
	updateIntentFn,
} from "#/server/intents";

function pageFromSearch(value: unknown) {
	const page = typeof value === "number" ? value : Number(value);
	return Number.isInteger(page) && page > 0 ? page : 1;
}

export const Route = createFileRoute("/requests")({
	validateSearch: (
		search: Record<string, unknown>,
	): {
		filter?: Filter;
		postsPage?: number;
		incomingPage?: number;
		connectionsPage?: number;
	} => ({
		filter:
			search.filter === "request" ||
			search.filter === "offer" ||
			search.filter === "archived"
				? search.filter
				: undefined,
		postsPage:
			search.postsPage === undefined
				? undefined
				: pageFromSearch(search.postsPage),
		incomingPage:
			search.incomingPage === undefined
				? undefined
				: pageFromSearch(search.incomingPage),
		connectionsPage:
			search.connectionsPage === undefined
				? undefined
				: pageFromSearch(search.connectionsPage),
	}),
	loaderDeps: ({ search }) => ({
		filter: search.filter ?? "all",
		postsPage: search.postsPage ?? 1,
		incomingPage: search.incomingPage ?? 1,
		connectionsPage: search.connectionsPage ?? 1,
	}),
	loader: ({ deps }) =>
		getMyBoardPaginatedFn({
			data: {
				postFilter: deps.filter,
				postsPage: deps.postsPage,
				incomingPage: deps.incomingPage,
				connectionsPage: deps.connectionsPage,
				pageSize: 6,
			},
		}),
	pendingComponent: () => <PagePending cards={2} />,
	errorComponent: PageError,
	component: RequestsPage,
});

type Filter = "all" | "request" | "offer" | "archived";

const filterLabels: Array<{ value: Filter; label: string }> = [
	{ value: "all", label: "All activity" },
	{ value: "request", label: "Help I need" },
	{ value: "offer", label: "Help I offered" },
	{ value: "archived", label: "Archived" },
];

function RequestsPage() {
	const {
		isAuthenticated,
		items,
		incoming,
		connections,
		postsPagination,
		incomingPagination,
		connectionsPagination,
	} = Route.useLoaderData();
	const search = Route.useSearch();
	const navigate = Route.useNavigate();
	const router = useRouter();
	const filter: Filter = search.filter ?? "all";
	const [busyId, setBusyId] = useState<string | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [acceptedIds, setAcceptedIds] = useState<Set<string>>(new Set());

	const visibleIncoming = useMemo(
		() => incoming.filter((item) => !acceptedIds.has(item.id)),
		[acceptedIds, incoming],
	);

	const filteredItems = items;

	function changeFilter(nextFilter: Filter) {
		void navigate({
			to: "/requests",
			search: {
				filter: nextFilter,
				postsPage: 1,
				incomingPage: search.incomingPage,
				connectionsPage: search.connectionsPage,
			},
		});
	}

	async function accept(item: IncomingInterest) {
		if (busyId) return;
		setError(null);
		setBusyId(item.id);

		try {
			await acceptMatchFn({ data: { matchId: item.id } });
			setAcceptedIds((current) => new Set(current).add(item.id));
			notifyToast({
				title: "Match accepted",
				description: `${item.fromDisplayName} will see your contact details.`,
			});
			await router.invalidate();
		} catch {
			setError("We couldn't accept that yet. Please try again.");
		} finally {
			setBusyId(null);
		}
	}

	async function archive(item: BoardItem) {
		if (busyId) return;
		setError(null);
		setBusyId(item.id);

		try {
			await archiveIntentFn({
				data: { postId: item.id, postType: item.type },
			});
			notifyToast({
				title: item.status === "completed" ? "Post archived" : "Post withdrawn",
				description:
					item.status === "completed"
						? "It’s off Accepted matches and saved in Archived."
						: "It’s off the community board. You can restore it later.",
			});
			await router.invalidate();
		} catch {
			setError("We couldn't archive that yet. Please try again.");
		} finally {
			setBusyId(null);
		}
	}

	async function update(
		item: BoardItem,
		values: {
			title: string;
			description: string;
			skills: string[];
			minutes: number | null;
			availability: string | null;
		},
	) {
		if (busyId) return;
		setError(null);
		setBusyId(item.id);
		try {
			await updateIntentFn({
				data: {
					postId: item.id,
					postType: item.type,
					...values,
				},
			});
			notifyToast({
				title: item.type === "request" ? "Request updated" : "Offer updated",
				description: "Your changes are live on the community board.",
			});
			await router.invalidate();
		} catch (caughtError) {
			setError(
				caughtError instanceof Error
					? caughtError.message
					: "We couldn't save those changes.",
			);
			throw caughtError;
		} finally {
			setBusyId(null);
		}
	}

	async function restore(item: BoardItem) {
		if (busyId) return;
		setError(null);
		setBusyId(item.id);

		try {
			await restoreIntentFn({
				data: { postId: item.id, postType: item.type },
			});
			notifyToast({
				title: "Post restored",
				description: "It’s back in your active requests and offers.",
			});
			await router.invalidate();
		} catch {
			setError("We couldn't restore that yet. Please try again.");
		} finally {
			setBusyId(null);
		}
	}

	async function complete(connection: ActiveConnection) {
		if (busyId) return;
		setError(null);
		setBusyId(connection.id);

		try {
			const result = await completeMatchFn({
				data: { matchId: connection.id },
			});
			if (
				result.status === "completed" &&
				connection.postType === "request" &&
				connection.role === "recipient"
			) {
				fireRequestFulfilled(connection.id);
			}
			notifyToast({
				title:
					result.status === "completed"
						? connection.postType === "request" &&
							connection.role === "recipient"
							? "Request fulfilled"
							: "Hours verified"
						: "Waiting on your partner",
				description:
					result.status === "completed"
						? `Both people confirmed ${connection.minutes} minutes.`
						: `${connection.partnerName} still needs to confirm.`,
			});
			await router.invalidate();
		} catch {
			setError("We couldn't confirm those hours yet. Please try again.");
		} finally {
			setBusyId(null);
		}
	}

	async function retryAudit(connection: ActiveConnection) {
		if (busyId) return;
		setError(null);
		setBusyId(connection.id);

		try {
			await retrySolanaAuditFn({ data: { matchId: connection.id } });
			notifyToast({
				title: "Receipt published",
				description: "The Solana audit trail is updating.",
			});
			await router.invalidate();
		} catch {
			setError(
				"We couldn't publish that Solana receipt yet. Please try again.",
			);
		} finally {
			setBusyId(null);
		}
	}

	async function sendThankYou(connection: ActiveConnection, message: string) {
		if (busyId) return;
		setError(null);
		setBusyId(connection.id);
		try {
			await sendThankYouFn({ data: { matchId: connection.id, message } });
			notifyToast({
				title: "Thank-you sent",
				description: `${connection.partnerName} will get your note.`,
			});
			await router.invalidate();
		} catch {
			setError("We couldn't send that thank-you yet. Please try again.");
			throw new Error("send-failed");
		} finally {
			setBusyId(null);
		}
	}

	async function archiveCompleted(connection: ActiveConnection) {
		if (busyId) return;
		setError(null);
		setBusyId(connection.id);

		try {
			await archiveCompletedPostFn({ data: { matchId: connection.id } });
			notifyToast({
				title: "Completed post archived",
				description: "It’s off Accepted matches and saved in Archived.",
			});
			await router.invalidate();
		} catch {
			setError("We couldn't archive that post yet. Please try again.");
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
								<PaginationControls
									page={incomingPagination.page}
									totalPages={incomingPagination.totalPages}
									totalItems={incomingPagination.totalItems}
									itemLabel="incoming replies"
									onPageChange={(incomingPage) =>
										void navigate({
											to: "/requests",
											search: {
												...search,
												incomingPage,
											},
										})
									}
								/>
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
											onRetryAudit={() => void retryAudit(connection)}
											onArchive={() => void archiveCompleted(connection)}
											onThankYou={(message) =>
												sendThankYou(connection, message)
											}
											onOpenThankYou={() =>
												fireThankYou({
													fromName: connection.partnerName,
													message: connection.thankYouMessage ?? "",
													entityId: `thankyou:${connection.id}`,
													replay: true,
												})
											}
										/>
									))}
								</div>
								<PaginationControls
									page={connectionsPagination.page}
									totalPages={connectionsPagination.totalPages}
									totalItems={connectionsPagination.totalItems}
									itemLabel="accepted matches"
									onPageChange={(connectionsPage) =>
										void navigate({
											to: "/requests",
											search: {
												...search,
												connectionsPage,
											},
										})
									}
								/>
							</section>
						) : null}

						<div className="mt-10">
							<SegmentedControl
								layoutId="requests-filter"
								value={filter}
								onChange={changeFilter}
								options={filterLabels}
							/>
						</div>

						{filteredItems.length > 0 ? (
							<div className="mt-6 grid gap-4 md:grid-cols-2">
								<AnimatePresence mode="popLayout">
									{filteredItems.map((item, index) => {
										const done = item.status === "completed";
										const archived = item.status === "archived";
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
														{archived ? (
															<Button
																variant="outline"
																className="w-full gap-2"
																disabled={busyId === item.id}
																onClick={() => void restore(item)}
															>
																<ArchiveRestore className="size-4" />
																{busyId === item.id
																	? "Restoring…"
																	: "Restore post"}
															</Button>
														) : (
															<div className="grid gap-2">
																{!done ? (
																	<EditPostDialog
																		item={item}
																		busy={busyId === item.id}
																		onSave={(values) => update(item, values)}
																	/>
																) : null}
																<ArchivePostButton
																	busy={busyId === item.id}
																	onConfirm={() => void archive(item)}
																	actionLabel={done ? "Archive" : "Withdraw"}
																	title={
																		done
																			? "Archive this completed post?"
																			: item.type === "request"
																				? "Withdraw this request?"
																				: "Withdraw this offer?"
																	}
																	description={
																		done
																			? "It will leave Accepted matches and stay in your archived history."
																			: "It will leave the community board and pause pending replies. You can restore it later."
																	}
																/>
															</div>
														)}
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
										filter === "archived"
											? "No archived posts"
											: postsPagination.totalItems === 0
												? "Nothing here yet"
												: "No posts in this view"
									}
									description={
										filter === "archived"
											? "Posts you archive will stay safely out of the community board until you restore them."
											: postsPagination.totalItems === 0
												? "Describe what you need or what you can offer. VOLGO will turn it into a community-ready post."
												: "Try another filter to see the rest of your activity."
									}
									action={
										filter !== "archived" &&
										postsPagination.totalItems === 0 ? (
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
						<PaginationControls
							page={postsPagination.page}
							totalPages={postsPagination.totalPages}
							totalItems={postsPagination.totalItems}
							itemLabel="posts"
							onPageChange={(postsPage) =>
								void navigate({
									to: "/requests",
									search: {
										...search,
										postsPage,
									},
								})
							}
						/>
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
	onRetryAudit,
	onArchive,
	onThankYou,
	onOpenThankYou,
}: {
	connection: ActiveConnection;
	busy: boolean;
	onConfirm: () => void;
	onRetryAudit: () => void;
	onArchive: () => void;
	onThankYou: (message: string) => Promise<void>;
	onOpenThankYou: () => void;
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
					<div className="space-y-3">
						<div className="flex items-center gap-2 text-sm font-medium text-primary">
							<Check className="size-4" />
							Both people verified these hours
						</div>
						<SolanaAuditStatus
							audit={connection.audit}
							busy={busy}
							onRetry={onRetryAudit}
						/>
						{connection.role === "recipient" ? (
							connection.thankYouSent ? (
								<p className="text-sm text-muted-foreground">
									Thank-you sent to {connection.partnerName}.
								</p>
							) : (
								<ThankYouDialog
									connection={connection}
									busy={busy}
									onSend={onThankYou}
								/>
							)
						) : connection.thankYouSent ? (
							<Button
								variant="outline"
								size="sm"
								className="w-full gap-2"
								onClick={onOpenThankYou}
							>
								<Mail className="size-4" aria-hidden="true" />
								Open thank-you
							</Button>
						) : null}
						{verifiedByBoth ? (
							<Button
								variant="outline"
								size="sm"
								className="w-full gap-2"
								disabled={busy}
								onClick={onArchive}
							>
								<Archive className="size-4" aria-hidden="true" />
								{busy ? "Archiving…" : "Archive completed post"}
							</Button>
						) : null}
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

import { auth, clerkClient } from "@clerk/tanstack-react-start/server";
import {
	createFileRoute,
	Link,
	useNavigate,
	useRouter,
} from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import {
	ArrowRight,
	ArrowUp,
	BadgeCheck,
	CalendarClock,
	Check,
	Clock3,
	HandHeart,
	HelpingHand,
	MessageCircleQuestion,
	RotateCcw,
	Sparkles,
	Users,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { type ReactNode, useRef, useState } from "react";

import AppShell from "#/components/app-shell";
import PageError from "#/components/page-error";
import PagePending from "#/components/page-pending";
import { Badge } from "#/components/ui/badge";
import { Button } from "#/components/ui/button";
import { Skeleton } from "#/components/ui/skeleton";
import { Textarea } from "#/components/ui/textarea";
import type { CommunityPost } from "#/features/community/schema";
import type {
	CapturedIntent,
	ConversationMessage,
} from "#/features/intents/schema";
import { localAnalyzeIntent } from "#/lib/clarify";
import { notifyToast } from "#/lib/notify-toast";
import {
	getCommunityStatsFn,
	getDiscoverFeedFn,
	getImpactFn,
} from "#/server/community";
import { analyzeIntentFn, publishIntentFn } from "#/server/intents";

const authStateFn = createServerFn().handler(async () => {
	const { isAuthenticated, userId } = await auth();

	if (!isAuthenticated || !userId) {
		return { userId: null, firstName: null };
	}

	const user = await clerkClient().users.getUser(userId);
	return { userId, firstName: user.firstName };
});

export const Route = createFileRoute("/")({
	component: Home,
	pendingComponent: () => <PagePending cards={3} />,
	errorComponent: PageError,
	beforeLoad: () => authStateFn(),
	loader: async ({ context }) => {
		const [feed, communityStats, impact] = await Promise.all([
			getDiscoverFeedFn({
				data: { filter: "all", page: 1, pageSize: 3 },
			}),
			getCommunityStatsFn(),
			context.userId
				? getImpactFn({ data: { page: 1, pageSize: 3 } })
				: Promise.resolve(null),
		]);

		return {
			userId: context.userId,
			firstName: context.firstName,
			pulse: feed.items.slice(0, 3),
			communityStats,
			recentActivity: impact?.recent ?? [],
		};
	},
});

function getFriendlyError(error: unknown, fallback: string) {
	if (
		error instanceof Error &&
		error.message.toLowerCase().includes("must be signed in")
	) {
		return "Please sign in before continuing.";
	}

	return fallback;
}

function Suggestion({
	children,
	onClick,
}: {
	children: ReactNode;
	onClick: () => void;
}) {
	return (
		<button
			type="button"
			className="rounded-full border bg-background/70 px-3 py-1.5 text-sm text-muted-foreground backdrop-blur transition-colors hover:text-foreground"
			onClick={onClick}
		>
			{children}
		</button>
	);
}

function IntentPreview({
	intent,
	isSaving,
	onReset,
	onPublish,
}: {
	intent: CapturedIntent;
	isSaving: boolean;
	onReset: () => void;
	onPublish: () => void;
}) {
	const isOffer = intent.type === "offer";

	return (
		<motion.section
			layoutId="intent-panel"
			initial={{ opacity: 0, y: 16, scale: 0.98 }}
			animate={{ opacity: 1, y: 0, scale: 1 }}
			exit={{ opacity: 0, y: 8, scale: 0.98 }}
			transition={{ type: "spring", stiffness: 280, damping: 26 }}
			className="overflow-hidden rounded-2xl border bg-card shadow-lg shadow-foreground/5"
			aria-label="Review your post"
		>
			<div className="flex items-center justify-between border-b px-5 py-4">
				<div className="flex items-center gap-3">
					<div className="flex size-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
						{isOffer ? (
							<HandHeart className="size-4" />
						) : (
							<HelpingHand className="size-4" />
						)}
					</div>
					<div>
						<p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
							{isOffer ? "I can help" : "I need help"}
						</p>
						<p className="text-sm font-medium">Ready for your review</p>
					</div>
				</div>
				<div className="flex items-center gap-1.5 text-xs text-muted-foreground">
					<Sparkles className="size-3.5" />
					AI organized
				</div>
			</div>

			<div className="p-5">
				<h2 className="text-xl font-semibold tracking-tight">{intent.title}</h2>
				<p className="mt-2 text-sm leading-6 text-muted-foreground">
					{intent.description}
				</p>

				<div className="mt-4 flex flex-wrap gap-2">
					{intent.skills.map((skill) => (
						<Badge key={skill} variant="secondary">
							{skill}
						</Badge>
					))}
					{intent.minutes ? (
						<Badge variant="outline" className="gap-1.5">
							<Clock3 className="size-3" />
							{intent.minutes} minutes
						</Badge>
					) : null}
					{intent.availability ? (
						<Badge variant="outline" className="gap-1.5">
							<CalendarClock className="size-3" />
							{intent.availability}
						</Badge>
					) : null}
				</div>
			</div>

			<div className="flex flex-col-reverse gap-2 border-t bg-muted/30 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
				<Button variant="ghost" className="gap-2" onClick={onReset}>
					<RotateCcw className="size-4" />
					Start over
				</Button>
				<Button className="gap-2" disabled={isSaving} onClick={onPublish}>
					{isSaving ? (
						<>
							<Sparkles className="size-4 animate-pulse" />
							Publishing…
						</>
					) : (
						<>
							<Check className="size-4" />
							{isOffer ? "Share my offer" : "Post my request"}
						</>
					)}
				</Button>
			</div>
		</motion.section>
	);
}

function OrganizingCard({ note }: { note: string }) {
	return (
		<motion.section
			layoutId="intent-panel"
			initial={{ opacity: 0, y: 12 }}
			animate={{ opacity: 1, y: 0 }}
			exit={{ opacity: 0, y: 8 }}
			className="overflow-hidden rounded-2xl border bg-card p-5 shadow-md shadow-foreground/5"
			aria-live="polite"
		>
			<div className="flex items-center gap-3">
				<div className="flex size-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
					<Sparkles className="size-4 animate-pulse" />
				</div>
				<div>
					<p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
						Reading your note
					</p>
					<p className="text-sm font-medium">Organizing the details…</p>
				</div>
			</div>
			{note ? (
				<p className="mt-4 text-sm leading-6 text-muted-foreground">{note}</p>
			) : (
				<div className="mt-5 space-y-2">
					<Skeleton className="h-3 w-full" />
					<Skeleton className="h-3 w-4/5" />
					<Skeleton className="h-3 w-2/3" />
				</div>
			)}
			<div className="mt-5 flex gap-2">
				<Skeleton className="h-5 w-16 rounded-full" />
				<Skeleton className="h-5 w-20 rounded-full" />
				<Skeleton className="h-5 w-14 rounded-full" />
			</div>
		</motion.section>
	);
}

function QuestionLoadingCard() {
	return (
		<motion.section
			layoutId="intent-panel"
			initial={{ opacity: 0, y: 12 }}
			animate={{ opacity: 1, y: 0 }}
			exit={{ opacity: 0, y: 8 }}
			className="overflow-hidden rounded-2xl border bg-card shadow-md shadow-foreground/5"
			aria-live="polite"
		>
			<div className="flex items-center gap-3 border-b px-5 py-4">
				<div className="flex size-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
					<MessageCircleQuestion className="size-4 animate-pulse" />
				</div>
				<div>
					<p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
						Making this easier to match
					</p>
					<p className="text-sm font-medium">
						Preparing a few follow-up questions…
					</p>
				</div>
			</div>
			<div className="space-y-3 p-5">
				<div className="rounded-xl border bg-muted/30 p-4">
					<Skeleton className="h-3 w-4/5" />
				</div>
				<div className="rounded-xl border bg-muted/30 p-4">
					<Skeleton className="h-3 w-2/3" />
				</div>
			</div>
		</motion.section>
	);
}

function ClarifyingCard({
	note,
	questions,
	onSkip,
}: {
	note: string;
	questions: string[];
	onSkip: () => void;
}) {
	return (
		<motion.section
			layoutId="intent-panel"
			initial={{ opacity: 0, y: 12 }}
			animate={{ opacity: 1, y: 0 }}
			exit={{ opacity: 0, y: 8 }}
			className="overflow-hidden rounded-2xl border bg-card shadow-md shadow-foreground/5"
			aria-live="polite"
		>
			<div className="flex items-center gap-3 border-b px-5 py-4">
				<div className="flex size-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
					<MessageCircleQuestion className="size-4" />
				</div>
				<div>
					<p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
						A couple of details
					</p>
					<p className="text-sm font-medium">
						Help us make this easier to match
					</p>
				</div>
			</div>
			<div className="p-5">
				<p className="text-sm leading-6 text-muted-foreground">{note}</p>
				<ol className="mt-4 space-y-2">
					{questions.map((question, index) => (
						<li
							key={question}
							className="rounded-xl border bg-muted/30 px-4 py-3 text-sm leading-6"
						>
							<span className="mr-2 text-xs font-medium text-muted-foreground">
								{index + 1}
							</span>
							{question}
						</li>
					))}
				</ol>
			</div>
			<div className="flex justify-end border-t bg-muted/30 px-5 py-3">
				<Button variant="ghost" size="sm" onClick={onSkip}>
					Post with what I have
				</Button>
			</div>
		</motion.section>
	);
}

function PublishedCard({ intent }: { intent: CapturedIntent }) {
	const isOffer = intent.type === "offer";

	return (
		<motion.section
			layoutId="intent-panel"
			className="overflow-hidden rounded-2xl border bg-card p-6 text-center shadow-lg shadow-foreground/5"
		>
			<div className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
				<Check className="size-5" />
			</div>
			<h2 className="mt-4 text-xl font-semibold tracking-tight">
				{isOffer ? "Your offer is live" : "Your request is live"}
			</h2>
			<p className="mt-2 text-sm text-muted-foreground">
				Looking for people in the community who fit {intent.title.toLowerCase()}
				.
			</p>
		</motion.section>
	);
}

type RecentActivityItem = Pick<
	CommunityPost,
	"id" | "type" | "title" | "status"
>;

function HomeActivity({
	community,
	recent,
	isSignedIn,
}: {
	community: CommunityPost[];
	recent: RecentActivityItem[];
	isSignedIn: boolean;
}) {
	if (community.length === 0 && !isSignedIn) return null;

	return (
		<motion.section
			initial={{ opacity: 0, y: 10 }}
			animate={{ opacity: 1, y: 0 }}
			transition={{ delay: 0.2 }}
			className={`mt-6 grid gap-4 ${isSignedIn ? "lg:grid-cols-2" : ""}`}
			aria-label="Activity overview"
		>
			{isSignedIn ? (
				<div className="overflow-hidden rounded-2xl border bg-card/70">
					<div className="flex items-center justify-between gap-4 border-b px-4 py-3.5">
						<div>
							<h2 className="text-sm font-semibold">Your recent activity</h2>
							<p className="mt-0.5 text-xs text-muted-foreground">
								Your latest requests and offers.
							</p>
						</div>
						<Button
							render={
								<Link to="/requests" search={{ filter: "all", postsPage: 1 }} />
							}
							nativeButton={false}
							variant="ghost"
							size="sm"
							className="gap-1"
						>
							View all
							<ArrowRight className="size-3.5" aria-hidden="true" />
						</Button>
					</div>
					{recent.length > 0 ? (
						<div className="divide-y">
							{recent.map((item) => (
								<Link
									key={item.id}
									to="/requests"
									search={{ filter: "all", postsPage: 1 }}
									className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/40"
								>
									<div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/8 text-primary">
										{item.type === "offer" ? (
											<HandHeart className="size-3.5" aria-hidden="true" />
										) : (
											<HelpingHand className="size-3.5" aria-hidden="true" />
										)}
									</div>
									<p className="min-w-0 flex-1 truncate text-sm font-medium">
										{item.title}
									</p>
									<span className="rounded-full bg-muted px-2 py-1 text-[10px] font-medium capitalize text-muted-foreground">
										{item.status}
									</span>
								</Link>
							))}
						</div>
					) : (
						<p className="px-4 py-6 text-center text-xs text-muted-foreground">
							Your posts will appear here once you share one.
						</p>
					)}
				</div>
			) : null}

			<div className="overflow-hidden rounded-2xl border bg-card/70">
				<div className="flex items-center justify-between gap-4 border-b px-4 py-3.5">
					<div>
						<h2 className="text-sm font-semibold">Happening nearby</h2>
						<p className="mt-0.5 text-xs text-muted-foreground">
							What the community is exchanging now.
						</p>
					</div>
					<Button
						render={<Link to="/discover" search={{ filter: "all", page: 1 }} />}
						nativeButton={false}
						variant="ghost"
						size="sm"
						className="gap-1"
					>
						Discover
						<ArrowRight className="size-3.5" aria-hidden="true" />
					</Button>
				</div>
				{community.length > 0 ? (
					<div className="divide-y">
						{community.map((item) => (
							<Link
								key={item.id}
								to="/discover"
								search={{ filter: "all", page: 1 }}
								className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/40"
							>
								<div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
									{item.type === "offer" ? (
										<HandHeart className="size-3.5" aria-hidden="true" />
									) : (
										<HelpingHand className="size-3.5" aria-hidden="true" />
									)}
								</div>
								<div className="min-w-0 flex-1">
									<p className="truncate text-sm font-medium">{item.title}</p>
									<p className="truncate text-xs text-muted-foreground">
										{item.displayName}
									</p>
								</div>
							</Link>
						))}
					</div>
				) : (
					<p className="px-4 py-6 text-center text-xs text-muted-foreground">
						The community board is quiet right now.
					</p>
				)}
			</div>
		</motion.section>
	);
}

type IntentMode = "request" | "offer";

function IntentModePicker({
	value,
	onChange,
	disabled,
}: {
	value: IntentMode;
	onChange: (value: IntentMode) => void;
	disabled: boolean;
}) {
	const options: Array<{
		value: IntentMode;
		title: string;
		description: string;
		icon: ReactNode;
	}> = [
		{
			value: "request",
			title: "I need help",
			description: "Ask the community for a hand",
			icon: <HelpingHand className="size-5" />,
		},
		{
			value: "offer",
			title: "I want to help",
			description: "Share time or a skill",
			icon: <HandHeart className="size-5" />,
		},
	];

	return (
		<fieldset className="mb-4 grid grid-cols-2 gap-3">
			<legend className="sr-only">Choose a post type</legend>
			{options.map((option) => {
				const selected = value === option.value;
				return (
					<button
						key={option.value}
						type="button"
						disabled={disabled}
						onClick={() => onChange(option.value)}
						className={`rounded-2xl border p-4 text-left transition-all disabled:cursor-not-allowed disabled:opacity-60 ${
							selected
								? "border-primary bg-primary/8 shadow-sm"
								: "bg-card hover:bg-muted/40"
						}`}
						aria-pressed={selected}
					>
						<div
							className={`mb-3 flex size-9 items-center justify-center rounded-xl ${
								selected
									? "bg-primary text-primary-foreground"
									: "bg-muted text-muted-foreground"
							}`}
						>
							{option.icon}
						</div>
						<p className="text-sm font-semibold">{option.title}</p>
						<p className="mt-1 text-xs text-muted-foreground">
							{option.description}
						</p>
					</button>
				);
			})}
		</fieldset>
	);
}

function CommunityStats({
	stats,
}: {
	stats: {
		activePosts: number;
		members: number;
		completedExchanges: number;
		verifiedMinutes: number;
	};
}) {
	const verifiedHours = stats.verifiedMinutes / 60;
	const items = [
		{
			label: "Community members",
			value: stats.members.toLocaleString(),
			icon: <Users className="size-4" />,
		},
		{
			label: "Open ways to help",
			value: stats.activePosts.toLocaleString(),
			icon: <HandHeart className="size-4" />,
		},
		{
			label: "Verified exchanges",
			value: stats.completedExchanges.toLocaleString(),
			icon: <BadgeCheck className="size-4" />,
		},
		{
			label: "Hours given",
			value:
				stats.verifiedMinutes < 60
					? `${stats.verifiedMinutes} min`
					: `${verifiedHours.toFixed(verifiedHours >= 10 ? 0 : 1)} hrs`,
			icon: <Clock3 className="size-4" />,
		},
	];

	return (
		<motion.section
			initial={{ opacity: 0, y: 10 }}
			animate={{ opacity: 1, y: 0 }}
			transition={{ delay: 0.18 }}
			className="mt-12 overflow-hidden rounded-2xl border bg-card/70"
			aria-labelledby="community-stats-heading"
		>
			<div className="flex flex-col gap-2 border-b px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
				<div>
					<h2 id="community-stats-heading" className="text-sm font-semibold">
						Community in motion
					</h2>
					<p className="mt-1 text-xs text-muted-foreground">
						Real time shared, confirmed by both people.
					</p>
				</div>
				<Link
					to="/leaderboard"
					search={{ page: 1 }}
					className="text-xs font-medium text-primary hover:underline"
				>
					Meet the volunteers
				</Link>
			</div>
			<div className="grid grid-cols-2 divide-x divide-y sm:grid-cols-4 sm:divide-y-0">
				{items.map((item) => (
					<div key={item.label} className="p-4">
						<div className="flex items-center gap-2 text-muted-foreground">
							{item.icon}
							<span className="text-[11px]">{item.label}</span>
						</div>
						<p className="mt-2 font-heading text-xl font-semibold tabular-nums">
							{item.value}
						</p>
					</div>
				))}
			</div>
		</motion.section>
	);
}

function Home() {
	const [intentMode, setIntentMode] = useState<IntentMode>("request");
	const [prompt, setPrompt] = useState("");
	const [history, setHistory] = useState<ConversationMessage[]>([]);
	const [clarifying, setClarifying] = useState<{
		note: string;
		questions: string[];
	} | null>(null);
	const [draft, setDraft] = useState<CapturedIntent | null>(null);
	const [published, setPublished] = useState<CapturedIntent | null>(null);
	const [workingNote, setWorkingNote] = useState("");
	const [isAnalyzing, setIsAnalyzing] = useState(false);
	const [isLoadingQuestions, setIsLoadingQuestions] = useState(false);
	const [isSaving, setIsSaving] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const analysisVersion = useRef(0);
	const state = Route.useLoaderData();
	const navigate = useNavigate();
	const router = useRouter();

	async function analyze(messages: ConversationMessage[], force = false) {
		const version = ++analysisVersion.current;
		setError(null);
		setDraft(null);
		setIsAnalyzing(true);
		setWorkingNote("");

		const optimistic = localAnalyzeIntent(messages, force);
		if (optimistic.status === "clarify") {
			setClarifying(null);
			setIsLoadingQuestions(true);
		} else {
			setClarifying(null);
			setIsLoadingQuestions(false);
		}

		try {
			const result = await analyzeIntentFn({ data: { messages, force } });
			if (version !== analysisVersion.current) return;

			setIsLoadingQuestions(false);
			setWorkingNote(result.note);
			setHistory([...messages, { role: "assistant", content: result.note }]);

			if (result.status === "ready" && result.intent) {
				setClarifying(null);
				setDraft(result.intent);
				return;
			}

			setClarifying({
				note: result.note,
				questions: result.questions,
			});
		} catch (caughtError) {
			if (version !== analysisVersion.current) return;

			setIsLoadingQuestions(false);
			if (optimistic.status === "ready" && optimistic.intent) {
				setDraft(optimistic.intent);
				return;
			}

			if (optimistic.status === "clarify") {
				setClarifying({
					note: optimistic.note,
					questions: optimistic.questions,
				});
				return;
			}

			setError(
				getFriendlyError(
					caughtError,
					"We couldn't organize that yet. Please try again.",
				),
			);
		} finally {
			if (version === analysisVersion.current) {
				setIsAnalyzing(false);
			}
		}
	}

	async function submitPrompt(nextPrompt?: string) {
		const value = (nextPrompt ?? prompt).trim();

		if (!value || isAnalyzing || published) return;

		setPrompt("");
		const contextualValue =
			history.length === 0
				? intentMode === "request"
					? `I need help with: ${value}`
					: `I can offer help with: ${value}`
				: value;
		const messages: ConversationMessage[] = [
			...history,
			{ role: "user", content: contextualValue },
		];
		setHistory(messages);
		await analyze(messages);
	}

	async function skipQuestions() {
		if (history.length === 0 || isAnalyzing) return;
		await analyze(history, true);
	}

	async function publishIntent() {
		if (!draft || isSaving) return;

		if (!state.userId) {
			await navigate({ to: "/login" });
			return;
		}

		setError(null);
		setIsSaving(true);

		try {
			await publishIntentFn({ data: { intent: draft } });
			notifyToast({
				title:
					draft.type === "offer"
						? "Your offer is live"
						: "Your request is live",
				description: `“${draft.title}” is now on the community board.`,
			});
			await router.invalidate();
			setPublished(draft);
			setDraft(null);
			setClarifying(null);
			window.setTimeout(() => {
				void navigate({ to: "/requests" });
			}, 900);
		} catch (caughtError) {
			setError(
				getFriendlyError(
					caughtError,
					"Your post couldn't be published. Please try again.",
				),
			);
			setIsSaving(false);
		}
	}

	function resetDraft() {
		analysisVersion.current += 1;
		setDraft(null);
		setClarifying(null);
		setHistory([]);
		setWorkingNote("");
		setIsLoadingQuestions(false);
		setError(null);
	}

	const isWorking = isAnalyzing;

	return (
		<AppShell>
			<div className="relative isolate overflow-hidden">
				<img
					src="https://storage.volgo.org/YARN%20BACKGROUND.png"
					alt=""
					aria-hidden="true"
					className="pointer-events-none absolute top-0 left-1/2 z-0 w-[min(1920px,160vw)] max-w-none -translate-x-1/2 select-none [mask-image:linear-gradient(to_bottom,black_70%,transparent)]"
				/>
				<main className="relative z-10 mx-auto flex min-h-[calc(100vh-4rem)] max-w-5xl flex-col items-center px-6 py-14 sm:py-20">
					<div className="w-full max-w-3xl">
					<motion.div
						initial={{ opacity: 0, y: 12 }}
						animate={{ opacity: 1, y: 0 }}
						className="mb-8 text-center"
					>
						<div className="mb-5 flex justify-center">
								<img src="https://storage.volgo.org/CATHATON.png" alt="CATHATON" className="h-20 w-auto dark:hidden" />
                <img src="https://storage.volgo.org/CATHATON%20(1).png" alt="CATHATON" className="h-20 w-auto dark:block hidden" />

						</div>

						<h1 className="font-heading text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
							{intentMode === "request"
								? state.firstName
									? `What do you need, ${state.firstName}?`
									: "What do you need help with?"
								: state.firstName
									? `How would you like to help, ${state.firstName}?`
									: "How would you like to help?"}
						</h1>
						<p className="mx-auto mt-3 max-w-xl text-base text-muted-foreground">
							{intentMode === "request"
								? "Describe what would make things easier. We’ll turn it into a clear request."
								: "Share a skill or some time. We’ll turn it into an offer people can find."}
						</p>
					</motion.div>

					<IntentModePicker
						value={intentMode}
						onChange={setIntentMode}
						disabled={history.length > 0 || isWorking || Boolean(published)}
					/>

					<div className="rounded-2xl border bg-card p-2 shadow-md shadow-foreground/5 transition-shadow focus-within:shadow-lg">
						<Textarea
							value={prompt}
							onChange={(event) => setPrompt(event.target.value)}
							onKeyDown={(event) => {
								if (event.key === "Enter" && !event.shiftKey) {
									event.preventDefault();
									void submitPrompt();
								}
							}}
							placeholder={
								clarifying
									? "Answer in your own words…"
									: intentMode === "request"
										? "I need help moving a desk this afternoon…"
										: "I can tutor calculus on Saturday morning…"
							}
							className="min-h-28 resize-none border-0 bg-transparent px-4 py-3 text-base shadow-none focus-visible:ring-0"
							aria-label={
								intentMode === "request"
									? "Describe the help you need"
									: "Describe the help you can offer"
							}
							disabled={Boolean(published)}
						/>

						<div className="flex items-center justify-between px-2 pb-1">
							<div className="flex items-center gap-2 text-xs text-muted-foreground">
								<Sparkles className="size-3.5" />
								{isLoadingQuestions
									? "Preparing the right questions"
									: clarifying
										? "Answer below, then send"
										: intentMode === "request"
											? "This will become a request"
											: "This will become an offer"}
							</div>

							<Button
								size="icon"
								className="rounded-xl"
								disabled={!prompt.trim() || isAnalyzing || Boolean(published)}
								onClick={() => void submitPrompt()}
								aria-label="Send"
							>
								<ArrowUp className="size-4" />
							</Button>
						</div>
					</div>

					{!draft && !isWorking && !published && !clarifying ? (
						<motion.div
							initial={{ opacity: 0 }}
							animate={{ opacity: 1 }}
							transition={{ delay: 0.15 }}
							className="mt-4 flex flex-wrap justify-center gap-2"
						>
							{intentMode === "request" ? (
								<>
									<Suggestion
										onClick={() => void submitPrompt("something this week")}
									>
										I’m not sure where to start
									</Suggestion>
									<Suggestion
										onClick={() =>
											void submitPrompt(
												"moving a desk this afternoon for about 30 minutes",
											)
										}
									>
										Help me move
									</Suggestion>
									<Suggestion
										onClick={() =>
											void submitPrompt("studying for calculus this weekend")
										}
									>
										Study help
									</Suggestion>
								</>
							) : (
								<>
									<Suggestion
										onClick={() =>
											void submitPrompt("someone, but I’m not sure how yet")
										}
									>
										I’m open to helping
									</Suggestion>
									<Suggestion
										onClick={() =>
											void submitPrompt(
												"Java or Linux for two hours Saturday afternoon",
											)
										}
									>
										Programming help
									</Suggestion>
									<Suggestion
										onClick={() =>
											void submitPrompt(
												"with moving or lifting for an hour this week",
											)
										}
									>
										Moving help
									</Suggestion>
								</>
							)}
						</motion.div>
					) : null}

					{error ? (
						<motion.div
							initial={{ opacity: 0, y: 6 }}
							animate={{ opacity: 1, y: 0 }}
							className="mt-4 flex items-center justify-between gap-4 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
							role="alert"
						>
							<span>{error}</span>
							<Button variant="ghost" size="sm" onClick={() => setError(null)}>
								Dismiss
							</Button>
						</motion.div>
					) : null}

					<AnimatePresence mode="wait">
						{published ? (
							<div className="mt-6" key="published">
								<PublishedCard intent={published} />
							</div>
						) : draft ? (
							<div className="mt-6" key="draft">
								<IntentPreview
									intent={draft}
									isSaving={isSaving}
									onReset={resetDraft}
									onPublish={() => void publishIntent()}
								/>
							</div>
						) : isLoadingQuestions ? (
							<div className="mt-6" key="question-loading">
								<QuestionLoadingCard />
							</div>
						) : clarifying && !isWorking ? (
							<div className="mt-6" key="clarify">
								<ClarifyingCard
									note={clarifying.note}
									questions={clarifying.questions}
									onSkip={() => void skipQuestions()}
								/>
							</div>
						) : isWorking ? (
							<div className="mt-6" key="organizing">
								<OrganizingCard note={workingNote} />
							</div>
						) : null}
					</AnimatePresence>

					{!state.userId ? (
						<p className="mt-5 flex items-center justify-center gap-1 text-center text-sm text-muted-foreground">
							Sign in with your Virginia Tech account to post and match.
							<Button
								variant="link"
								className="gap-1 px-1"
								onClick={() => void navigate({ to: "/login" })}
							>
								Get started
								<ArrowRight className="size-3.5" />
							</Button>
						</p>
					) : null}

					{!draft && !isWorking && !published && !clarifying ? (
						<>
							<CommunityStats stats={state.communityStats} />
							<HomeActivity
								community={state.pulse}
								recent={state.recentActivity}
								isSignedIn={Boolean(state.userId)}
							/>
						</>
					) : null}
					</div>
				</main>
			</div>
		</AppShell>
	);
}

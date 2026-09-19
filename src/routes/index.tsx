import { auth, clerkClient } from "@clerk/tanstack-react-start/server";
import { useChat } from "@tanstack/ai-react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import {
	ArrowRight,
	ArrowUp,
	CalendarClock,
	Check,
	Clock3,
	HandHeart,
	HelpingHand,
	RotateCcw,
	Sparkles,
	Square,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";

import Navigation from "#/components/navigation";
import { Badge } from "#/components/ui/badge";
import { Button } from "#/components/ui/button";
import { Textarea } from "#/components/ui/textarea";
import type { CapturedIntent } from "#/features/intents/schema";
import { chatFn } from "#/server/chat";
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
	beforeLoad: () => authStateFn(),
	loader: async ({ context }) => ({
		userId: context.userId,
		firstName: context.firstName,
	}),
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
	children: React.ReactNode;
	onClick: () => void;
}) {
	return (
		<Button
			variant="outline"
			size="sm"
			className="rounded-full bg-background/70 text-muted-foreground shadow-none backdrop-blur hover:text-foreground"
			onClick={onClick}
		>
			{children}
		</Button>
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

function Home() {
	const [prompt, setPrompt] = useState("");
	const [draft, setDraft] = useState<CapturedIntent | null>(null);
	const [isAnalyzing, setIsAnalyzing] = useState(false);
	const [isSaving, setIsSaving] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const state = Route.useLoaderData();
	const navigate = useNavigate();

	const { messages, sendMessage, isLoading, stop } = useChat({
		fetcher: ({ messages: nextMessages }, { signal }) =>
			chatFn({ data: { messages: nextMessages }, signal }),
	});

	async function submitPrompt() {
		const value = prompt.trim();

		if (!value || isLoading || isAnalyzing) return;

		if (!state.userId) {
			await navigate({ to: "/login" });
			return;
		}

		setError(null);
		setDraft(null);
		setIsAnalyzing(true);
		sendMessage(value);
		setPrompt("");

		try {
			const intent = await analyzeIntentFn({ data: { prompt: value } });
			setDraft(intent);
		} catch (caughtError) {
			setError(
				getFriendlyError(
					caughtError,
					"We couldn't organize that yet. Please try again.",
				),
			);
		} finally {
			setIsAnalyzing(false);
		}
	}

	async function publishIntent() {
		if (!draft || isSaving) return;

		setError(null);
		setIsSaving(true);

		try {
			await publishIntentFn({ data: { intent: draft } });
			await navigate({ to: "/requests" });
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
		setDraft(null);
		setError(null);
	}

	const isWorking = isLoading || isAnalyzing;

	return (
		<div className="min-h-screen bg-background text-foreground">
			<Navigation />

			<main className="relative mx-auto flex min-h-[calc(100vh-4rem)] max-w-5xl flex-col items-center px-6 py-14 sm:py-20">
				<div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-80 bg-[radial-gradient(ellipse_at_top,var(--primary)/8%,transparent_62%)]" />

				<div className="w-full max-w-3xl">
					<motion.div
						initial={{ opacity: 0, y: 12 }}
						animate={{ opacity: 1, y: 0 }}
						className="mb-8 text-center"
					>
						<div className="mb-5 flex justify-center">
							<div className="flex size-11 items-center justify-center rounded-2xl border bg-card shadow-sm">
								<HandHeart className="size-5 text-primary" />
							</div>
						</div>

						<h1 className="font-heading text-4xl font-semibold tracking-tight sm:text-5xl">
							{state.firstName
								? `How can we help, ${state.firstName}?`
								: "How can we help?"}
						</h1>
						<p className="mx-auto mt-3 max-w-xl text-base text-muted-foreground">
							Tell us what you need, or how you’d like to help someone else.
							We’ll organize the details.
						</p>
					</motion.div>

					<AnimatePresence initial={false} mode="popLayout">
						{messages.length > 0 ? (
							<motion.div
								initial={{ opacity: 0, height: 0 }}
								animate={{ opacity: 1, height: "auto" }}
								className="mb-4 space-y-3"
							>
								{messages.map((message) => (
									<div
										key={message.id}
										className={
											message.role === "user"
												? "flex justify-end"
												: "flex justify-start"
										}
									>
										<div
											className={
												message.role === "user"
													? "max-w-[85%] rounded-2xl rounded-br-md bg-primary px-4 py-3 text-sm leading-6 text-primary-foreground"
													: "max-w-[85%] rounded-2xl rounded-bl-md bg-muted px-4 py-3 text-sm leading-6 text-foreground"
											}
										>
											{message.parts
												.flatMap((part) =>
													part.type === "text" ? [part.content] : [],
												)
												.join("")}
										</div>
									</div>
								))}

								{isWorking ? (
									<div className="flex justify-start">
										<div className="flex items-center gap-2 rounded-2xl rounded-bl-md bg-muted px-4 py-3 text-sm text-muted-foreground">
											<Sparkles className="size-4 animate-pulse" />
											Organizing the details…
										</div>
									</div>
								) : null}
							</motion.div>
						) : null}
					</AnimatePresence>

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
							placeholder="I need help moving a desk this afternoon…"
							className="min-h-28 resize-none border-0 bg-transparent px-4 py-3 text-base shadow-none focus-visible:ring-0"
							aria-label="Describe what you need or how you can help"
						/>

						<div className="flex items-center justify-between px-2 pb-1">
							<div className="flex items-center gap-2 text-xs text-muted-foreground">
								<Sparkles className="size-3.5" />
								VOLGO understands the details
							</div>

							{isLoading ? (
								<Button
									size="icon"
									variant="secondary"
									className="rounded-xl"
									onClick={stop}
									aria-label="Stop response"
								>
									<Square className="size-4 fill-current" />
								</Button>
							) : (
								<Button
									size="icon"
									className="rounded-xl"
									disabled={!prompt.trim() || isAnalyzing}
									onClick={() => void submitPrompt()}
									aria-label="Send"
								>
									<ArrowUp className="size-4" />
								</Button>
							)}
						</div>
					</div>

					{messages.length === 0 ? (
						<motion.div
							initial={{ opacity: 0 }}
							animate={{ opacity: 1 }}
							transition={{ delay: 0.15 }}
							className="mt-4 flex flex-wrap justify-center gap-2"
						>
							<Suggestion
								onClick={() =>
									setPrompt("I need help studying for calculus this week.")
								}
							>
								Help me study
							</Suggestion>
							<Suggestion
								onClick={() =>
									setPrompt("I have an hour free and want to help someone.")
								}
							>
								I have an hour to give
							</Suggestion>
							<Suggestion
								onClick={() =>
									setPrompt("I need someone to help me move something.")
								}
							>
								Help me move
							</Suggestion>
							<Suggestion
								onClick={() =>
									setPrompt("I can help someone with Java or Linux.")
								}
							>
								Offer programming help
							</Suggestion>
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

					<AnimatePresence>
						{draft ? (
							<div className="mt-6">
								<IntentPreview
									intent={draft}
									isSaving={isSaving}
									onReset={resetDraft}
									onPublish={() => void publishIntent()}
								/>
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
				</div>
			</main>
		</div>
	);
}

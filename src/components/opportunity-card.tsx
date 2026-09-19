import { Link } from "@tanstack/react-router";
import { CalendarClock, Clock3, HandHeart, HelpingHand } from "lucide-react";
import { motion } from "motion/react";
import type { ReactNode } from "react";

import StatusBadge from "#/components/status-badge";
import { Badge } from "#/components/ui/badge";
import type { IntentListItem } from "#/features/intents/schema";

export function formatPostedDate(value: string) {
	return new Intl.DateTimeFormat("en-US", {
		month: "short",
		day: "numeric",
	}).format(new Date(value));
}

export default function OpportunityCard({
	item,
	index,
	footer,
	matchScore,
	matchExplanation,
	person,
	personHref,
	featured = false,
}: {
	item: Pick<
		IntentListItem,
		| "id"
		| "type"
		| "title"
		| "description"
		| "skills"
		| "minutes"
		| "availability"
		| "status"
		| "createdAt"
	>;
	index?: number;
	footer?: ReactNode;
	matchScore?: number | null;
	matchExplanation?: string | null;
	person?: string;
	personHref?: string;
	featured?: boolean;
}) {
	const isOffer = item.type === "offer";

	return (
		<motion.article
			layout
			initial={{ opacity: 0, y: 16 }}
			animate={{ opacity: 1, y: 0 }}
			exit={{ opacity: 0, scale: 0.98 }}
			transition={{
				delay: Math.min((index ?? 0) * 0.045, 0.22),
				type: "spring",
				stiffness: 280,
				damping: 28,
			}}
			whileHover={{ y: -2 }}
			className={
				featured
					? "flex h-full flex-col rounded-2xl border border-primary/20 bg-card p-5 shadow-md shadow-primary/5"
					: "flex h-full flex-col rounded-2xl border bg-card p-5 shadow-sm"
			}
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
							{person && personHref ? (
								<>
									{" · "}
									<Link
										to="/users/$userId"
										params={{ userId: personHref }}
										className="hover:text-foreground"
									>
										{person}
									</Link>
								</>
							) : person ? (
								` · ${person}`
							) : null}
						</p>
						<h2 className="mt-1 text-lg font-semibold tracking-tight">
							{item.title}
						</h2>
					</div>
				</div>
				{typeof matchScore === "number" ? (
					<MatchMeter score={matchScore} />
				) : (
					<StatusBadge status={item.status} />
				)}
			</div>

			<p className="mt-4 line-clamp-3 text-sm leading-6 text-muted-foreground">
				{item.description}
			</p>

			{matchExplanation ? (
				<p className="mt-3 text-sm leading-6 text-foreground/85">
					{matchExplanation}
				</p>
			) : null}

			<div className="mt-4 flex flex-wrap gap-2">
				{item.skills.map((skill) => (
					<Badge key={skill} variant="secondary">
						{skill}
					</Badge>
				))}
			</div>

			<div className="mt-auto flex flex-wrap items-center gap-x-4 gap-y-2 border-t pt-4 text-xs text-muted-foreground">
				{item.minutes ? (
					<span className="flex items-center gap-1.5">
						<Clock3 className="size-3.5" />
						{item.minutes} min
					</span>
				) : null}
				{item.availability ? (
					<span className="flex items-center gap-1.5">
						<CalendarClock className="size-3.5" />
						{item.availability}
					</span>
				) : null}
				<span className="ml-auto">
					Posted {formatPostedDate(item.createdAt)}
				</span>
			</div>

			{footer ? <div className="mt-4">{footer}</div> : null}
		</motion.article>
	);
}

function MatchMeter({ score }: { score: number }) {
	const radius = 16;
	const circumference = 2 * Math.PI * radius;
	const offset = circumference - (score / 100) * circumference;

	return (
		<div
			className="relative size-12 shrink-0"
			role="img"
			aria-label={`Match ${score}`}
		>
			<svg viewBox="0 0 40 40" className="-rotate-90" aria-hidden="true">
				<circle
					cx="20"
					cy="20"
					r={radius}
					fill="none"
					className="stroke-muted"
					strokeWidth="3"
				/>
				<motion.circle
					cx="20"
					cy="20"
					r={radius}
					fill="none"
					className="stroke-primary"
					strokeWidth="3"
					strokeDasharray={circumference}
					initial={{ strokeDashoffset: circumference }}
					animate={{ strokeDashoffset: offset }}
					transition={{ duration: 0.85, ease: [0.22, 1, 0.36, 1] }}
					strokeLinecap="round"
				/>
			</svg>
			<span className="absolute inset-0 grid place-items-center text-[11px] font-semibold tabular-nums">
				{score}
			</span>
		</div>
	);
}

export function EmptyState({
	title,
	description,
	action,
}: {
	title: string;
	description: string;
	action?: ReactNode;
}) {
	return (
		<motion.div
			initial={{ opacity: 0, y: 8 }}
			animate={{ opacity: 1, y: 0 }}
			className="flex flex-col items-center rounded-2xl border border-dashed bg-card/40 px-6 py-16 text-center"
		>
			<div className="flex size-12 items-center justify-center rounded-2xl bg-muted">
				<HelpingHand className="size-5 text-muted-foreground" />
			</div>
			<h2 className="mt-5 text-lg font-semibold">{title}</h2>
			<p className="mt-2 max-w-sm text-sm leading-6 text-muted-foreground">
				{description}
			</p>
			{action}
		</motion.div>
	);
}

export function SignInPrompt() {
	return (
		<EmptyState
			title="Sign in to continue"
			description="Your Virginia Tech account keeps requests private until you choose to share them with the community."
			action={
				<Link
					to="/login"
					className="mt-5 inline-flex h-8 items-center rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground"
				>
					Sign in
				</Link>
			}
		/>
	);
}

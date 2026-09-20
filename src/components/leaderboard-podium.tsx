import { Link } from "@tanstack/react-router";
import { Crown, Trophy } from "lucide-react";
import { motion } from "motion/react";

import { Avatar, AvatarFallback } from "#/components/ui/avatar";
import type { LeaderboardEntry } from "#/features/community/schema";

function initials(name: string) {
	const parts = name.trim().split(/\s+/).filter(Boolean);
	if (parts.length === 0) return "?";
	return parts
		.slice(0, 2)
		.map((part) => part[0]?.toUpperCase() ?? "")
		.join("");
}

function formatTime(minutes: number) {
	if (minutes < 60) return `${minutes} min`;
	const hours = minutes / 60;
	return `${hours.toFixed(hours >= 10 ? 0 : 1)} hrs`;
}

const podium = {
	1: {
		height: "h-52 sm:h-60",
		riseDelay: 1.05,
		face: "bg-gradient-to-b from-amber-300 via-amber-400 to-amber-600",
		glow: "shadow-[0_0_40px_rgba(245,178,22,0.45)]",
		number: "text-amber-950/80",
		ring: "border-amber-300 bg-amber-400 text-amber-950",
	},
	2: {
		height: "h-36 sm:h-44",
		riseDelay: 0.45,
		face: "bg-gradient-to-b from-slate-200 via-slate-300 to-slate-500",
		glow: "shadow-[0_0_28px_rgba(148,163,184,0.35)]",
		number: "text-slate-800/80",
		ring: "border-slate-200 bg-slate-300 text-slate-800",
	},
	3: {
		height: "h-28 sm:h-36",
		riseDelay: 0.08,
		face: "bg-gradient-to-b from-orange-300 via-orange-400 to-orange-700",
		glow: "shadow-[0_0_28px_rgba(234,88,12,0.35)]",
		number: "text-orange-950/80",
		ring: "border-orange-300 bg-orange-400 text-orange-950",
	},
} as const;

function PodiumPlace({ entry }: { entry: LeaderboardEntry }) {
	const style = podium[entry.rank as 1 | 2 | 3];
	if (!style) return null;
	const isFirst = entry.rank === 1;

	return (
		<motion.div
			className={`flex min-w-0 flex-1 flex-col items-center justify-end ${isFirst ? "z-10" : "z-0"}`}
			initial={{ y: 160, opacity: 0 }}
			animate={{ y: 0, opacity: 1 }}
			transition={{
				type: "spring",
				stiffness: 120,
				damping: 16,
				delay: style.riseDelay,
			}}
		>
			<Link
				to="/users/$userId"
				params={{ userId: entry.userId }}
				className="flex w-full flex-col items-center"
			>
				<motion.div
					className="relative mb-2 flex flex-col items-center"
					initial={{ scale: 0.6, y: 18 }}
					animate={{ scale: 1, y: 0 }}
					transition={{
						type: "spring",
						stiffness: 260,
						damping: 14,
						delay: style.riseDelay + 0.28,
					}}
				>
					{isFirst ? (
						<motion.div
							className="absolute -top-7 text-amber-400"
							animate={{ y: [0, -5, 0], rotate: [-8, 8, -8] }}
							transition={{
								duration: 2.4,
								repeat: Number.POSITIVE_INFINITY,
								ease: "easeInOut",
							}}
						>
							<Crown className="size-7 fill-amber-400" aria-hidden="true" />
						</motion.div>
					) : null}
					<Avatar
						className={`size-14 border-4 shadow-md sm:size-16 ${style.ring} ${isFirst ? "size-16 sm:size-20" : ""}`}
					>
						<AvatarFallback
							className={`${style.ring} font-heading text-lg font-bold sm:text-xl`}
						>
							{initials(entry.displayName)}
						</AvatarFallback>
					</Avatar>
					<p className="mt-2 max-w-[7.5rem] truncate text-center font-heading text-sm font-semibold sm:max-w-[9rem] sm:text-base">
						{entry.displayName}
					</p>
					<p className="text-[11px] font-medium text-muted-foreground sm:text-xs">
						{formatTime(entry.verifiedMinutes)}
					</p>
				</motion.div>

				<div
					className={`relative flex w-full max-w-[7.5rem] items-end justify-center overflow-hidden rounded-t-2xl sm:max-w-[9.5rem] ${style.height} ${style.face} ${style.glow}`}
				>
					<div className="absolute inset-x-0 top-0 h-1/3 bg-gradient-to-b from-white/35 to-transparent" />
					<div className="absolute inset-y-0 left-0 w-3 bg-black/10" />
					<div className="absolute inset-y-0 right-0 w-3 bg-white/10" />
					<span
						className={`relative mb-4 font-heading text-6xl font-bold tracking-tight sm:text-7xl ${style.number}`}
					>
						{entry.rank}
					</span>
					{isFirst ? (
						<Trophy
							className="absolute top-4 size-6 text-amber-950/70"
							aria-hidden="true"
						/>
					) : null}
				</div>
			</Link>
		</motion.div>
	);
}

export default function LeaderboardPodium({
	entries,
}: {
	entries: LeaderboardEntry[];
}) {
	const first = entries.find((entry) => entry.rank === 1);
	const second = entries.find((entry) => entry.rank === 2);
	const third = entries.find((entry) => entry.rank === 3);
	if (!first && !second && !third) return null;

	return (
		<section className="relative overflow-hidden rounded-[2rem] border bg-card px-3 pt-10 pb-0 shadow-sm sm:px-8">
			<div className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-[radial-gradient(ellipse_at_top,var(--primary)/16%,transparent_70%)]" />
			<div className="relative mb-4 text-center sm:mb-6">
				<p className="text-[11px] font-medium tracking-[0.32em] text-primary uppercase">
					Podium
				</p>
				<h2 className="mt-2 font-heading text-2xl font-semibold tracking-tight">
					Time given, ranked
				</h2>
			</div>
			<div className="relative mx-auto flex max-w-3xl items-end justify-center gap-1 pt-10 sm:gap-4 sm:pt-12">
				{second ? <PodiumPlace entry={second} /> : <div className="flex-1" />}
				{first ? <PodiumPlace entry={first} /> : <div className="flex-1" />}
				{third ? <PodiumPlace entry={third} /> : <div className="flex-1" />}
			</div>
			<div className="h-3 rounded-t-full bg-gradient-to-r from-muted via-primary/25 to-muted" />
		</section>
	);
}

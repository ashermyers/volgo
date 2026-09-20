"use client";

import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { Button } from "#/components/ui/button";
import {
	requestFulfilledEvent,
	type ThankYouDetail,
	thankYouEvent,
} from "#/lib/celebrations";

const CONFETTI_COLORS = [
	"#4fb8b2",
	"#2f6a4a",
	"#f4d27a",
	"#f7f1e3",
	"#e27d60",
	"#7eb8da",
];

type Piece = {
	x: number;
	y: number;
	w: number;
	h: number;
	vx: number;
	vy: number;
	rot: number;
	vr: number;
	color: string;
};

function burstConfetti(canvas: HTMLCanvasElement) {
	const ctx = canvas.getContext("2d");
	if (!ctx) return () => {};

	const dpr = Math.min(window.devicePixelRatio || 1, 2);
	canvas.width = window.innerWidth * dpr;
	canvas.height = window.innerHeight * dpr;
	ctx.scale(dpr, dpr);

	const width = window.innerWidth;
	const height = window.innerHeight;
	const pieces: Piece[] = Array.from({ length: 140 }, (_, index) => ({
		x: Math.random() * width,
		y: -24 - Math.random() * height * 0.35,
		w: 6 + Math.random() * 8,
		h: 8 + Math.random() * 12,
		vx: -2.4 + Math.random() * 4.8,
		vy: 2.8 + Math.random() * 5.2,
		rot: Math.random() * Math.PI,
		vr: -0.22 + Math.random() * 0.44,
		color: CONFETTI_COLORS[index % CONFETTI_COLORS.length] ?? "#4fb8b2",
	}));

	let frame = 0;
	let raf = 0;
	const draw = () => {
		ctx.clearRect(0, 0, width, height);
		for (const piece of pieces) {
			piece.x += piece.vx;
			piece.y += piece.vy;
			piece.vy += 0.06;
			piece.rot += piece.vr;
			ctx.save();
			ctx.translate(piece.x, piece.y);
			ctx.rotate(piece.rot);
			ctx.fillStyle = piece.color;
			ctx.globalAlpha = Math.max(0, 1 - frame / 150);
			ctx.fillRect(-piece.w / 2, -piece.h / 2, piece.w, piece.h);
			ctx.restore();
		}
		frame += 1;
		if (frame < 150) raf = window.requestAnimationFrame(draw);
	};
	raf = window.requestAnimationFrame(draw);
	return () => window.cancelAnimationFrame(raf);
}

export default function CelebrationOverlay() {
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const [showConfetti, setShowConfetti] = useState(false);
	const [note, setNote] = useState<ThankYouDetail | null>(null);
	const [flapOpen, setFlapOpen] = useState(false);

	useEffect(() => {
		const onFulfilled = () => {
			setShowConfetti(true);
		};
		const onThankYou = (event: Event) => {
			const detail = (event as CustomEvent<ThankYouDetail>).detail;
			if (!detail?.message) return;
			setNote(detail);
			setFlapOpen(false);
		};
		window.addEventListener(requestFulfilledEvent, onFulfilled);
		window.addEventListener(thankYouEvent, onThankYou);
		return () => {
			window.removeEventListener(requestFulfilledEvent, onFulfilled);
			window.removeEventListener(thankYouEvent, onThankYou);
		};
	}, []);

	useEffect(() => {
		if (!showConfetti) return;
		let stop = () => {};
		const frame = window.requestAnimationFrame(() => {
			if (canvasRef.current) stop = burstConfetti(canvasRef.current);
		});
		const hide = window.setTimeout(() => setShowConfetti(false), 2800);
		return () => {
			window.cancelAnimationFrame(frame);
			stop();
			window.clearTimeout(hide);
		};
	}, [showConfetti]);

	useEffect(() => {
		if (!note) return;
		const open = window.setTimeout(() => setFlapOpen(true), 520);
		return () => window.clearTimeout(open);
	}, [note]);

	return (
		<div data-slot="celebration-host">
			{showConfetti ? (
				<div className="pointer-events-none fixed inset-0 z-[80]">
					<canvas ref={canvasRef} className="size-full" />
					<div className="absolute inset-x-0 top-[18%] flex justify-center px-6">
						<motion.p
							initial={{ opacity: 0, y: 12, scale: 0.96 }}
							animate={{ opacity: 1, y: 0, scale: 1 }}
							className="rounded-full border bg-card/90 px-5 py-2 font-heading text-sm font-semibold shadow-lg backdrop-blur-sm"
						>
							Your request was fulfilled
						</motion.p>
					</div>
				</div>
			) : null}

			<AnimatePresence>
				{note ? (
					<motion.div
						className="fixed inset-0 z-[90] flex items-center justify-center bg-foreground/35 p-6 backdrop-blur-sm"
						initial={{ opacity: 0 }}
						animate={{ opacity: 1 }}
						exit={{ opacity: 0 }}
						role="dialog"
						aria-modal="true"
						aria-labelledby="thank-you-envelope-title"
						onClick={() => setNote(null)}
					>
						<motion.div
							className="relative w-full max-w-sm"
							initial={{ y: 36, scale: 0.86, rotate: -6 }}
							animate={{ y: 0, scale: 1, rotate: 0 }}
							exit={{ y: 24, scale: 0.94, opacity: 0 }}
							transition={{ type: "spring", stiffness: 260, damping: 20 }}
							onClick={(event) => event.stopPropagation()}
						>
							<div className="relative mx-auto h-80 w-72">
								<motion.div
									className="absolute inset-x-4 top-0 z-30 rounded-2xl border bg-card px-5 py-5 shadow-xl"
									initial={{ y: 118, opacity: 0 }}
									animate={
										flapOpen ? { y: 0, opacity: 1 } : { y: 118, opacity: 0 }
									}
									transition={{ type: "spring", stiffness: 210, damping: 20 }}
								>
									<p
										id="thank-you-envelope-title"
										className="text-[11px] font-medium tracking-[0.22em] text-primary uppercase"
									>
										A note for you
									</p>
									<p className="mt-2 font-heading text-lg font-semibold">
										From {note.fromName}
									</p>
									<p className="mt-3 max-h-32 overflow-y-auto font-display text-[1.05rem] leading-7 text-pretty">
										{note.message}
									</p>
								</motion.div>

								<motion.div
									className="absolute inset-x-6 top-[4.5rem] z-40 origin-top"
									initial={{ scaleY: 1, opacity: 1 }}
									animate={
										flapOpen
											? { scaleY: 0.12, opacity: 0 }
											: { scaleY: 1, opacity: 1 }
									}
									transition={{ duration: 0.45, ease: "easeInOut" }}
								>
									<div
										className="h-24 bg-primary"
										style={{
											clipPath: "polygon(50% 0%, 100% 100%, 0% 100%)",
										}}
									/>
								</motion.div>

								<div className="absolute inset-x-0 bottom-0 z-20 h-40 overflow-hidden rounded-[1.6rem] bg-primary shadow-lg">
									<div className="absolute inset-x-8 top-12 h-px bg-primary-foreground/25" />
									<div className="absolute inset-x-12 top-16 h-px bg-primary-foreground/15" />
									<div className="absolute top-5 left-1/2 flex size-11 -translate-x-1/2 items-center justify-center rounded-full bg-amber-200 text-lg shadow-sm ring-2 ring-card">
										♥
									</div>
								</div>
							</div>

							<div className="mt-5 flex justify-center">
								<Button onClick={() => setNote(null)}>Tuck it away</Button>
							</div>
						</motion.div>
					</motion.div>
				) : null}
			</AnimatePresence>
		</div>
	);
}

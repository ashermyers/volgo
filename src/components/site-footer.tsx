import { Link } from "@tanstack/react-router";

const links = [
	{ to: "/discover", label: "Discover" },
	{ to: "/impact", label: "Impact" },
	{ to: "/leaderboard", label: "Leaders" },
	{ to: "/audit", label: "Audit" },
] as const;

export default function SiteFooter() {
	return (
		<footer className="relative mt-24 overflow-hidden border-t">
			<div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_bottom,var(--primary)/8%,transparent_55%)]" />
			<div className="relative mx-auto max-w-7xl px-6 pt-16 pb-10 sm:pt-20">
	
				<img src="https://storage.volgo.org/ASAAi.png" alt="ASAAi" className="mt-2 h-20 w-auto dark:invert" />

				{/* <p
					aria-label="ASAAi"
					className="mt-5 font-display text-[clamp(4.75rem,18vw,13.5rem)] leading-[0.72] font-medium tracking-[-0.07em] text-foreground"
				>
					<span aria-hidden="true">
						ASAA
						<span className="italic">i</span>
					</span>
				</p> */}

				<div className="mt-8 flex flex-col gap-6 border-t border-foreground/10 pt-6 sm:mt-10 sm:flex-row sm:items-end sm:justify-between ml-4">
					<div className="max-w-md">
						<p className="font-heading text-lg font-medium tracking-tight text-balance sm:text-xl">
							VOLGO was designed and built by ASAAi.
						</p>
						<p className="mt-2 text-sm leading-6 text-muted-foreground">
							Time given, community gained — a campus volunteering
							exchange for this hackathon.
						</p>
					</div>

					<nav
						aria-label="Footer"
						className="flex flex-wrap gap-x-5 gap-y-2 text-sm tracking-wide text-muted-foreground"
					>
						{links.map((link) => (
							<Link
								key={link.to}
								to={link.to}
								className="transition-colors hover:text-foreground"
							>
								{link.label}
							</Link>
						))}
					</nav>
				</div>

				<p className="mt-10 text-[11px] tracking-[0.28em] text-muted-foreground uppercase ml-4">
					© {new Date().getFullYear()} ASAAi
				</p>
			</div>
		</footer>
	);
}
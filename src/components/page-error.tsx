import { Link } from "@tanstack/react-router";
import { AlertCircle, RotateCcw } from "lucide-react";

import AppShell from "#/components/app-shell";
import { Button } from "#/components/ui/button";

export default function PageError({ reset }: { reset: () => void }) {
	return (
		<AppShell>
			<main className="mx-auto flex min-h-[60vh] max-w-xl items-center px-6 py-16">
				<section
					className="w-full rounded-3xl border bg-card/70 p-8 text-center shadow-sm"
					aria-labelledby="page-error-title"
				>
					<div className="mx-auto flex size-11 items-center justify-center rounded-2xl bg-destructive/10 text-destructive">
						<AlertCircle className="size-5" aria-hidden="true" />
					</div>
					<h1 id="page-error-title" className="mt-5 text-xl font-semibold">
						We couldn&apos;t load this page
					</h1>
					<p className="mt-2 text-sm leading-6 text-muted-foreground">
						Your place is safe. Try again, or return home and come back later.
					</p>
					<div className="mt-6 flex flex-col justify-center gap-2 sm:flex-row">
						<Button onClick={reset} className="gap-2">
							<RotateCcw className="size-4" aria-hidden="true" />
							Try again
						</Button>
						<Button variant="outline" render={<Link to="/" />}>
							Home
						</Button>
					</div>
				</section>
			</main>
		</AppShell>
	);
}

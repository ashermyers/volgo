import AppShell from "#/components/app-shell";
import { Skeleton } from "#/components/ui/skeleton";

export default function PagePending({ cards = 4 }: { cards?: number }) {
	const placeholders = ["a", "b", "c", "d", "e", "f"].slice(0, cards);

	return (
		<AppShell>
			<main className="mx-auto w-full max-w-5xl px-6 py-12 sm:py-16">
				<Skeleton className="h-4 w-28" />
				<Skeleton className="mt-4 h-10 w-72 max-w-full" />
				<Skeleton className="mt-3 h-4 w-full max-w-xl" />
				<div className="mt-10 grid gap-4 md:grid-cols-2">
					{placeholders.map((key) => (
						<div key={key} className="rounded-2xl border bg-card p-5">
							<div className="flex items-start gap-3">
								<Skeleton className="size-10 rounded-xl" />
								<div className="flex-1 space-y-2">
									<Skeleton className="h-3 w-24" />
									<Skeleton className="h-5 w-3/4" />
								</div>
							</div>
							<Skeleton className="mt-5 h-3 w-full" />
							<Skeleton className="mt-2 h-3 w-4/5" />
							<div className="mt-5 flex gap-2">
								<Skeleton className="h-5 w-16 rounded-full" />
								<Skeleton className="h-5 w-20 rounded-full" />
							</div>
						</div>
					))}
				</div>
			</main>
		</AppShell>
	);
}

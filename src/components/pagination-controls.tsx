import { ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "#/components/ui/button";

export default function PaginationControls({
	page,
	totalPages,
	totalItems,
	itemLabel = "items",
	onPageChange,
}: {
	page: number;
	totalPages: number;
	totalItems: number;
	itemLabel?: string;
	onPageChange: (page: number) => void;
}) {
	if (totalPages <= 1) return null;

	return (
		<nav
			className="mt-8 flex flex-col items-center justify-between gap-3 rounded-2xl border bg-card/60 p-3 sm:flex-row"
			aria-label={`${itemLabel} pagination`}
		>
			<p className="px-2 text-xs text-muted-foreground">
				{totalItems.toLocaleString()} {itemLabel}
			</p>
			<div className="flex items-center gap-2">
				<Button
					variant="outline"
					size="sm"
					className="gap-1"
					disabled={page <= 1}
					onClick={() => onPageChange(page - 1)}
					aria-label={`Previous ${itemLabel} page`}
				>
					<ChevronLeft className="size-4" />
					Previous
				</Button>
				<span
					className="min-w-20 text-center text-xs font-medium tabular-nums"
					aria-live="polite"
				>
					Page {page} of {totalPages}
				</span>
				<Button
					variant="outline"
					size="sm"
					className="gap-1"
					disabled={page >= totalPages}
					onClick={() => onPageChange(page + 1)}
					aria-label={`Next ${itemLabel} page`}
				>
					Next
					<ChevronRight className="size-4" />
				</Button>
			</div>
		</nav>
	);
}

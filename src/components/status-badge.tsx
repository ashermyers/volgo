import { Badge } from "#/components/ui/badge";

const labels: Record<string, string> = {
	open: "Open",
	active: "Active",
	matched: "Matched",
	completed: "Completed",
	pending: "Pending",
	archived: "Archived",
};

export default function StatusBadge({ status }: { status: string }) {
	const variant =
		status === "completed" || status === "archived"
			? "secondary"
			: status === "matched"
				? "default"
				: "outline";

	return (
		<Badge variant={variant} className="capitalize">
			{labels[status] ?? status}
		</Badge>
	);
}

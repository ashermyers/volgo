import type { ReactNode } from "react";

export default function PageHeader({
	kicker,
	title,
	description,
	actions,
}: {
	kicker: string;
	title: string;
	description: string;
	actions?: ReactNode;
}) {
	return (
		<div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
			<div className="max-w-2xl">
				<p className="text-sm font-medium text-primary">{kicker}</p>
				<h1 className="mt-2 font-heading text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
					{title}
				</h1>
				<p className="mt-2 max-w-xl text-muted-foreground">{description}</p>
			</div>
			{actions}
		</div>
	);
}

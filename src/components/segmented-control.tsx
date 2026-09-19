import { motion } from "motion/react";

import { cn } from "#/lib/utils";

type Option<T extends string> = {
	value: T;
	label: string;
};

export default function SegmentedControl<T extends string>({
	value,
	onChange,
	options,
	layoutId,
}: {
	value: T;
	onChange: (value: T) => void;
	options: Array<Option<T>>;
	layoutId: string;
}) {
	return (
		<div className="flex w-full gap-1 overflow-x-auto rounded-xl border bg-muted/50 p-1 sm:w-fit">
			{options.map((option) => {
				const selected = option.value === value;

				return (
					<button
						key={option.value}
						type="button"
						onClick={() => onChange(option.value)}
						className={cn(
							"relative shrink-0 rounded-lg px-3.5 py-1.5 text-sm font-medium transition-colors",
							selected
								? "text-foreground"
								: "text-muted-foreground hover:text-foreground",
						)}
					>
						{selected ? (
							<motion.span
								layoutId={layoutId}
								className="pointer-events-none absolute inset-0 rounded-lg bg-background shadow-sm"
								transition={{ type: "spring", stiffness: 420, damping: 32 }}
							/>
						) : null}
						<span className="relative z-10">{option.label}</span>
					</button>
				);
			})}
		</div>
	);
}

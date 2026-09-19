import { type KeyboardEvent, useState } from "react";

import { Badge } from "#/components/ui/badge";
import { Input } from "#/components/ui/input";

export default function TagInput({
	value,
	onChange,
	placeholder,
}: {
	value: string[];
	onChange: (value: string[]) => void;
	placeholder: string;
}) {
	const [draft, setDraft] = useState("");

	function add(raw: string) {
		const next = raw.trim();
		if (!next) return;
		if (value.some((item) => item.toLowerCase() === next.toLowerCase())) {
			setDraft("");
			return;
		}
		onChange([...value, next].slice(0, 12));
		setDraft("");
	}

	function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
		if (event.key === "Enter" || event.key === ",") {
			event.preventDefault();
			add(draft);
		}
		if (event.key === "Backspace" && !draft && value.length > 0) {
			onChange(value.slice(0, -1));
		}
	}

	return (
		<div className="rounded-xl border bg-background px-2 py-2">
			<div className="flex flex-wrap gap-1.5">
				{value.map((tag) => (
					<Badge key={tag} variant="secondary" className="gap-1">
						{tag}
						<button
							type="button"
							className="text-muted-foreground hover:text-foreground"
							onClick={() => onChange(value.filter((item) => item !== tag))}
							aria-label={`Remove ${tag}`}
						>
							×
						</button>
					</Badge>
				))}
				<Input
					value={draft}
					onChange={(event) => setDraft(event.target.value)}
					onKeyDown={onKeyDown}
					onBlur={() => add(draft)}
					placeholder={value.length === 0 ? placeholder : "Add another"}
					className="h-7 min-w-32 flex-1 border-0 bg-transparent shadow-none focus-visible:ring-0 dark:bg-transparent"
				/>
			</div>
		</div>
	);
}

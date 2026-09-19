import { Pencil } from "lucide-react";
import { useState } from "react";

import TagInput from "#/components/tag-input";
import { Button } from "#/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "#/components/ui/dialog";
import { Input } from "#/components/ui/input";
import { Label } from "#/components/ui/label";
import { Textarea } from "#/components/ui/textarea";
import type { BoardItem } from "#/features/community/schema";

export default function EditPostDialog({
	item,
	busy,
	onSave,
}: {
	item: BoardItem;
	busy: boolean;
	onSave: (values: {
		title: string;
		description: string;
		skills: string[];
		minutes: number | null;
		availability: string | null;
	}) => Promise<void>;
}) {
	const [open, setOpen] = useState(false);
	const [title, setTitle] = useState(item.title);
	const [description, setDescription] = useState(item.description);
	const [skills, setSkills] = useState(item.skills);
	const [minutes, setMinutes] = useState(
		item.minutes ? String(item.minutes) : "",
	);
	const [availability, setAvailability] = useState(item.availability ?? "");
	const [error, setError] = useState<string | null>(null);

	function reset() {
		setTitle(item.title);
		setDescription(item.description);
		setSkills(item.skills);
		setMinutes(item.minutes ? String(item.minutes) : "");
		setAvailability(item.availability ?? "");
		setError(null);
	}

	async function submit() {
		const parsedMinutes = minutes.trim() ? Number(minutes) : null;
		if (title.trim().length < 3 || description.trim().length < 8) {
			setError("Add a clearer title and a short description.");
			return;
		}
		if (
			parsedMinutes !== null &&
			(!Number.isInteger(parsedMinutes) ||
				parsedMinutes < 1 ||
				parsedMinutes > 480)
		) {
			setError("Minutes should be a whole number up to 8 hours.");
			return;
		}

		try {
			await onSave({
				title: title.trim(),
				description: description.trim(),
				skills: skills.slice(0, 6),
				minutes: parsedMinutes,
				availability: availability.trim() || null,
			});
			setOpen(false);
		} catch {
			setError("We couldn't save those changes. Please try again.");
		}
	}

	return (
		<Dialog
			open={open}
			onOpenChange={(next) => {
				setOpen(next);
				if (next) reset();
			}}
		>
			<DialogTrigger
				render={<Button variant="outline" className="w-full gap-2" />}
			>
				<Pencil className="size-4" aria-hidden="true" />
				Edit
			</DialogTrigger>
			<DialogContent className="sm:max-w-lg">
				<DialogHeader>
					<DialogTitle>
						{item.type === "request" ? "Edit request" : "Edit offer"}
					</DialogTitle>
					<DialogDescription>
						Changes go live immediately. People who already replied will be
						notified.
					</DialogDescription>
				</DialogHeader>
				<div className="grid gap-3">
					<div className="grid gap-1.5">
						<Label htmlFor={`title-${item.id}`}>Title</Label>
						<Input
							id={`title-${item.id}`}
							value={title}
							onChange={(event) => setTitle(event.target.value)}
							maxLength={72}
						/>
					</div>
					<div className="grid gap-1.5">
						<Label htmlFor={`description-${item.id}`}>Description</Label>
						<Textarea
							id={`description-${item.id}`}
							value={description}
							onChange={(event) => setDescription(event.target.value)}
							maxLength={600}
							rows={4}
						/>
					</div>
					<div className="grid gap-1.5">
						<Label>Skills</Label>
						<TagInput
							value={skills}
							onChange={(next) => setSkills(next.slice(0, 6))}
							placeholder="Add a skill"
						/>
					</div>
					<div className="grid grid-cols-2 gap-3">
						<div className="grid gap-1.5">
							<Label htmlFor={`minutes-${item.id}`}>Minutes</Label>
							<Input
								id={`minutes-${item.id}`}
								inputMode="numeric"
								value={minutes}
								onChange={(event) => setMinutes(event.target.value)}
								placeholder="60"
							/>
						</div>
						<div className="grid gap-1.5">
							<Label htmlFor={`availability-${item.id}`}>Availability</Label>
							<Input
								id={`availability-${item.id}`}
								value={availability}
								onChange={(event) => setAvailability(event.target.value)}
								placeholder="Tonight after 7"
								maxLength={120}
							/>
						</div>
					</div>
					{error ? (
						<p className="text-sm text-destructive" role="alert">
							{error}
						</p>
					) : null}
				</div>
				<DialogFooter>
					<Button variant="outline" onClick={() => setOpen(false)}>
						Cancel
					</Button>
					<Button disabled={busy} onClick={() => void submit()}>
						{busy ? "Saving…" : "Save changes"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}

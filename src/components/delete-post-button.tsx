import { useState } from "react";

import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
	AlertDialogTrigger,
} from "#/components/ui/alert-dialog";
import { Button } from "#/components/ui/button";

export default function ArchivePostButton({
	busy,
	onConfirm,
	actionLabel = "Archive",
	title = "Archive this post?",
	description = "It will leave the community board and pending replies will pause. You can restore it later from Archived.",
}: {
	busy: boolean;
	onConfirm: () => void;
	actionLabel?: string;
	title?: string;
	description?: string;
}) {
	const [open, setOpen] = useState(false);

	return (
		<AlertDialog open={open} onOpenChange={setOpen}>
			<AlertDialogTrigger
				render={
					<Button variant="ghost" className="w-full text-muted-foreground" />
				}
			>
				{actionLabel}
			</AlertDialogTrigger>
			<AlertDialogContent>
				<AlertDialogHeader>
					<AlertDialogTitle>{title}</AlertDialogTitle>
					<AlertDialogDescription>{description}</AlertDialogDescription>
				</AlertDialogHeader>
				<AlertDialogFooter>
					<AlertDialogCancel>Keep active</AlertDialogCancel>
					<AlertDialogAction
						disabled={busy}
						onClick={() => {
							onConfirm();
							setOpen(false);
						}}
					>
						{actionLabel}
					</AlertDialogAction>
				</AlertDialogFooter>
			</AlertDialogContent>
		</AlertDialog>
	);
}

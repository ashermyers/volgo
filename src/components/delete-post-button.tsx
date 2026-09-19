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
}: {
	busy: boolean;
	onConfirm: () => void;
}) {
	const [open, setOpen] = useState(false);

	return (
		<AlertDialog open={open} onOpenChange={setOpen}>
			<AlertDialogTrigger
				render={
					<Button variant="ghost" className="w-full text-muted-foreground" />
				}
			>
				Archive
			</AlertDialogTrigger>
			<AlertDialogContent>
				<AlertDialogHeader>
					<AlertDialogTitle>Archive this post?</AlertDialogTitle>
					<AlertDialogDescription>
						It will leave the community board and pending replies will pause.
						You can restore it later from Archived.
					</AlertDialogDescription>
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
						Archive
					</AlertDialogAction>
				</AlertDialogFooter>
			</AlertDialogContent>
		</AlertDialog>
	);
}

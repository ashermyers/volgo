import { Heart } from "lucide-react";
import { useState } from "react";

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
import { Label } from "#/components/ui/label";
import { Textarea } from "#/components/ui/textarea";
import type { ActiveConnection } from "#/features/community/schema";
import { sanitizeThankYouMessage, THANK_YOU_MAX_LENGTH } from "#/lib/thank-you";

export default function ThankYouDialog({
	connection,
	busy,
	onSend,
}: {
	connection: ActiveConnection;
	busy: boolean;
	onSend: (message: string) => Promise<void>;
}) {
	const [open, setOpen] = useState(false);
	const [message, setMessage] = useState("");
	const [error, setError] = useState<string | null>(null);
	const [sending, setSending] = useState(false);

	async function submit() {
		const next = sanitizeThankYouMessage(message);
		if (next.length < 2) {
			setError("Write a short note first.");
			return;
		}
		setSending(true);
		setError(null);
		try {
			await onSend(next);
			setOpen(false);
			setMessage("");
		} catch {
			setError("We couldn't send that yet. Please try again.");
		} finally {
			setSending(false);
		}
	}

	return (
		<Dialog open={open} onOpenChange={setOpen}>
			<DialogTrigger
				render={<Button variant="outline" size="sm" className="w-full gap-2" />}
			>
				<Heart className="size-4" aria-hidden="true" />
				Send a thank-you
			</DialogTrigger>
			<DialogContent className="sm:max-w-md">
				<DialogHeader>
					<DialogTitle>Thank {connection.partnerName}</DialogTitle>
					<DialogDescription>
						A short note for the person who helped you with “
						{connection.postTitle}”.
					</DialogDescription>
				</DialogHeader>
				<div className="space-y-2">
					<Label htmlFor={`thank-you-${connection.id}`}>Your note</Label>
					<Textarea
						id={`thank-you-${connection.id}`}
						value={message}
						onChange={(event) => setMessage(event.target.value)}
						placeholder="You made this so much easier. Thank you."
						className="min-h-28"
						maxLength={THANK_YOU_MAX_LENGTH}
					/>
					<p className="text-right text-[11px] text-muted-foreground">
						{sanitizeThankYouMessage(message).length}/{THANK_YOU_MAX_LENGTH}
					</p>
					{error ? (
						<p className="text-sm text-destructive" role="alert">
							{error}
						</p>
					) : null}
				</div>
				<DialogFooter>
					<Button disabled={sending || busy} onClick={() => void submit()}>
						{sending ? "Sending…" : "Send note"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}

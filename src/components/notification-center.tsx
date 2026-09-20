import { Link } from "@tanstack/react-router";
import { Bell } from "lucide-react";
import { useState } from "react";

import { Button } from "#/components/ui/button";
import {
	Popover,
	PopoverContent,
	PopoverHeader,
	PopoverTitle,
	PopoverTrigger,
} from "#/components/ui/popover";
import { useLiveNotifications } from "#/hooks/use-live-notifications";
import { fireThankYou, thankYouFromNotification } from "#/lib/celebrations";
import { markNotificationsReadFn } from "#/server/notifications";

function formatWhen(value: string) {
	const date = new Date(value);
	const delta = Date.now() - date.getTime();
	if (delta < 60_000) return "Just now";
	if (delta < 3_600_000) return `${Math.floor(delta / 60_000)}m ago`;
	if (delta < 86_400_000) return `${Math.floor(delta / 3_600_000)}h ago`;
	return date.toLocaleDateString();
}

export default function NotificationCenter() {
	const { items, unreadCount, refresh } = useLiveNotifications(true);
	const [open, setOpen] = useState(false);

	async function markRead(ids: string[], all = false) {
		await markNotificationsReadFn({ data: { ids, all } });
		await refresh();
	}

	return (
		<Popover open={open} onOpenChange={setOpen}>
			<PopoverTrigger
				render={
					<Button
						size="icon"
						variant="ghost"
						aria-label={
							unreadCount > 0
								? `${unreadCount} unread notifications`
								: "Notifications"
						}
					/>
				}
			>
				<span className="relative">
					<Bell className="size-4" />
					{unreadCount > 0 ? (
						<span className="absolute -top-1.5 -right-1.5 flex min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground">
							{unreadCount > 9 ? "9+" : unreadCount}
						</span>
					) : null}
				</span>
			</PopoverTrigger>
			<PopoverContent
				align="end"
				sideOffset={8}
				className="w-80 gap-0 overflow-hidden rounded-2xl p-0"
			>
				<PopoverHeader className="flex flex-row items-center justify-between gap-3 border-b px-4 py-3">
					<PopoverTitle>Notifications</PopoverTitle>
					{unreadCount > 0 ? (
						<Button
							variant="ghost"
							size="sm"
							className="h-7 px-2 text-xs"
							onClick={() => void markRead([], true)}
						>
							Mark all read
						</Button>
					) : null}
				</PopoverHeader>
				{items.length === 0 ? (
					<p className="px-4 py-8 text-center text-sm text-muted-foreground">
						You’re all caught up.
					</p>
				) : (
					<ul className="max-h-80 overflow-y-auto">
						{items.map((item) => (
							<li key={item.id} className="border-b last:border-b-0">
								<Link
									to={item.href === "/discover" ? "/discover" : "/requests"}
									search={
										item.href === "/discover"
											? { filter: "all", page: 1 }
											: { filter: undefined, postsPage: 1 }
									}
									className={`block px-4 py-3 transition-colors hover:bg-muted/50 ${
										item.readAt ? "opacity-70" : ""
									}`}
									onClick={() => {
										setOpen(false);
										if (item.type === "thank_you_received") {
											const { fromName, message } = thankYouFromNotification(
												item.title,
												item.body,
											);
											fireThankYou({
												fromName,
												message,
												entityId: item.entityId,
												replay: true,
											});
										}
										if (!item.readAt) void markRead([item.id]);
									}}
								>
									<p className="flex items-start gap-2 text-sm font-medium">
										{item.readAt ? null : (
											<span
												className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary"
												aria-hidden="true"
											/>
										)}
										{item.title}
									</p>
									<p className="mt-0.5 text-xs leading-5 text-muted-foreground">
										{item.body}
									</p>
									<p className="mt-1 text-[11px] text-muted-foreground">
										{formatWhen(item.createdAt)}
									</p>
								</Link>
							</li>
						))}
					</ul>
				)}
			</PopoverContent>
		</Popover>
	);
}

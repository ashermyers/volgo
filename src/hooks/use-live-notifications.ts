import { useRouter } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";

import type { NotificationItem } from "#/features/notifications/schema";
import { notificationRefreshEvent, notifyToast } from "#/lib/notify-toast";
import { getNotificationInboxFn } from "#/server/notifications";

const POLL_MS = 4000;

export function useLiveNotifications(enabled: boolean) {
	const router = useRouter();
	const seenIds = useRef(new Set<string>());
	const primed = useRef(false);
	const chain = useRef(Promise.resolve());
	const [items, setItems] = useState<NotificationItem[]>([]);
	const [unreadCount, setUnreadCount] = useState(0);

	const refresh = useCallback(() => {
		const run = async () => {
			try {
				const inbox = await getNotificationInboxFn({ data: { limit: 20 } });
				if (!inbox.isAuthenticated) {
					setItems([]);
					setUnreadCount(0);
					return;
				}

				const visibleUnread = inbox.items.filter((item) => !item.readAt).length;
				setItems(inbox.items);
				setUnreadCount(Math.max(inbox.unreadCount, visibleUnread));

				const fresh: NotificationItem[] = [];
				for (const item of inbox.items) {
					if (seenIds.current.has(item.id)) continue;
					fresh.push(item);
					seenIds.current.add(item.id);
				}

				if (!primed.current) {
					primed.current = true;
					return;
				}

				if (fresh.length === 0) return;

				for (const item of fresh) {
					if (item.type === "post_published") continue;
					notifyToast({
						type: item.type === "exchange_completed" ? "success" : "info",
						title: item.title,
						description: item.body,
					});
				}
				await router.invalidate();
			} catch {
				// Keep the last inbox if the poll fails.
			}
		};

		chain.current = chain.current.then(run, run);
		return chain.current;
	}, [router]);

	useEffect(() => {
		if (!enabled) return;

		void refresh();
		const timer = window.setInterval(() => {
			void refresh();
		}, POLL_MS);
		const onWake = () => {
			void refresh();
		};
		window.addEventListener("focus", onWake);
		window.addEventListener(notificationRefreshEvent, onWake);

		return () => {
			window.clearInterval(timer);
			window.removeEventListener("focus", onWake);
			window.removeEventListener(notificationRefreshEvent, onWake);
		};
	}, [enabled, refresh]);

	return { items, unreadCount, refresh };
}

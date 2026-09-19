import { toast } from "#/components/ui/toast";

export const notificationRefreshEvent = "volgo:notifications";

export function requestNotificationRefresh() {
	if (typeof window === "undefined") return;
	window.dispatchEvent(new Event(notificationRefreshEvent));
}

export function notifyToast({
	title,
	description,
	type = "success",
}: {
	title: string;
	description?: string;
	type?: "success" | "info" | "error" | "warning";
}) {
	toast.add({
		type,
		title,
		description,
	});
	requestNotificationRefresh();
}

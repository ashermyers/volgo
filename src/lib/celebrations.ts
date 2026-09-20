export const requestFulfilledEvent = "volgo:request-fulfilled";
export const thankYouEvent = "volgo:thank-you";

export type ThankYouDetail = {
	fromName: string;
	message: string;
	entityId: string;
	replay?: boolean;
};

function remember(key: string) {
	if (typeof window === "undefined") return false;
	try {
		if (sessionStorage.getItem(key)) return false;
		sessionStorage.setItem(key, "1");
		return true;
	} catch {
		return true;
	}
}

export function fireRequestFulfilled(matchId: string) {
	if (typeof window === "undefined" || !matchId) return;
	if (!remember(`volgo:celebrated:${matchId}`)) return;
	window.dispatchEvent(
		new CustomEvent(requestFulfilledEvent, { detail: { matchId } }),
	);
}

export function fireThankYou(detail: ThankYouDetail) {
	if (typeof window === "undefined" || !detail.message.trim()) return;
	if (!detail.replay && !remember(`volgo:thankyou:${detail.entityId}`)) {
		return;
	}
	window.dispatchEvent(new CustomEvent(thankYouEvent, { detail }));
}

export function thankYouFromNotification(title: string, body: string) {
	const fromName =
		title.replace(/^A thank-you from\s+/i, "").trim() || "Someone";
	return { fromName, message: body.trim() };
}

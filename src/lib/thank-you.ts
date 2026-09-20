export const THANK_YOU_MAX_LENGTH = 280;

export function sanitizeThankYouMessage(value: string) {
	return value.replace(/\s+/g, " ").trim().slice(0, THANK_YOU_MAX_LENGTH);
}

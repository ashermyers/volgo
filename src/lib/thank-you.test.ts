import { describe, expect, it } from "vitest";

import { sanitizeThankYouMessage, THANK_YOU_MAX_LENGTH } from "#/lib/thank-you";

describe("sanitizeThankYouMessage", () => {
	it("trims, collapses space, and caps length", () => {
		expect(sanitizeThankYouMessage("  thanks   so much  ")).toBe(
			"thanks so much",
		);
		expect(sanitizeThankYouMessage("x".repeat(400)).length).toBe(
			THANK_YOU_MAX_LENGTH,
		);
	});
});

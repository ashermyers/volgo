import { describe, expect, it } from "vitest";

import {
	paginationInputSchema,
	paginationMeta,
} from "#/features/pagination/schema";

describe("paginationMeta", () => {
	it("calculates boundaries and clamps pages beyond the final page", () => {
		expect(paginationMeta({ page: 1, pageSize: 12, totalItems: 25 })).toEqual({
			page: 1,
			pageSize: 12,
			totalItems: 25,
			totalPages: 3,
		});
		expect(paginationMeta({ page: 99, pageSize: 12, totalItems: 25 })).toEqual({
			page: 3,
			pageSize: 12,
			totalItems: 25,
			totalPages: 3,
		});
	});

	it("keeps empty collections on a stable first page", () => {
		expect(paginationMeta({ page: 4, pageSize: 6, totalItems: 0 })).toEqual({
			page: 1,
			pageSize: 6,
			totalItems: 0,
			totalPages: 1,
		});
	});

	it("defaults missing inputs and rejects unsafe page boundaries", () => {
		expect(paginationInputSchema.parse({})).toEqual({
			page: 1,
			pageSize: 12,
		});
		expect(paginationInputSchema.safeParse({ page: 0 }).success).toBe(false);
		expect(paginationInputSchema.safeParse({ page: 10_001 }).success).toBe(
			false,
		);
		expect(paginationInputSchema.safeParse({ pageSize: 25 }).success).toBe(
			false,
		);
	});
});

import { z } from "zod";

export const paginationInputSchema = z.object({
	page: z.number().int().min(1).max(10_000).default(1),
	pageSize: z.number().int().min(1).max(24).default(12),
});

export type PaginationMeta = {
	page: number;
	pageSize: number;
	totalItems: number;
	totalPages: number;
};

export function paginationMeta({
	page,
	pageSize,
	totalItems,
}: {
	page: number;
	pageSize: number;
	totalItems: number;
}): PaginationMeta {
	const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
	return {
		page: Math.min(page, totalPages),
		pageSize,
		totalItems,
		totalPages,
	};
}

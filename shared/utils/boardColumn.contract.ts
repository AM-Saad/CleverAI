// shared/boardColumn.contract.ts
import { z } from "zod";
import { BoardItemSchema } from "./boardItem.contract";

const trim = (v: unknown) => (typeof v === "string" ? v.trim() : v);
const optionalPosition = z.preprocess(
  (value) => (value === null ? undefined : value),
  z.string().regex(/^[0-9A-Za-z]+$/).optional(),
);

export const BoardColumnSchema = z.object({
  id: z.string(),
  userId: z.string(),
  name: z.string(),
  order: z.number().int().default(0),
  position: optionalPosition,
  workspaceId: z.string().nullable().optional(),
  /** Revision used by the offline-v2 optimistic concurrency protocol. */
  offlineRevision: z.number().int().nonnegative().optional(),

  createdAt: z.string().datetime().or(z.date()).or(z.string()),
  updatedAt: z.string().datetime().or(z.date()).or(z.string()),
});
export type BoardColumn = z.infer<typeof BoardColumnSchema>;

export const CreateBoardColumnDTO = z.object({
  name: z.preprocess(trim, z.string().min(1, "Column name is required")),
  workspaceId: z.string().optional(),
});
export type CreateBoardColumnDTO = z.infer<typeof CreateBoardColumnDTO>;

export const UpdateBoardColumnDTO = z.object({
  name: z.preprocess(trim, z.string().min(1)).optional(),
});
export type UpdateBoardColumnDTO = z.infer<typeof UpdateBoardColumnDTO>;

export const ReorderBoardColumnsDTO = z.object({
  columnOrders: z.array(
    z.object({
      id: z.string(),
      order: z.number().int().min(0),
    })
  ),
});
export type ReorderBoardColumnsDTO = z.infer<typeof ReorderBoardColumnsDTO>;

export const MoveItemToColumnDTO = z.object({
  itemId: z.string(),
  targetColumnId: z.string().nullable(), // null = uncategorized
  // Fractional rank (computed client-side from the target neighbours) so a move
  // is a single-item write rather than rewriting the whole column.
  rank: z.number(),
});
export type MoveItemToColumnDTO = z.infer<typeof MoveItemToColumnDTO>;

export const DeleteBoardColumnResponseSchema = z.object({
  deletedColumnId: z.string(),
  movedItems: z.array(BoardItemSchema).default([]),
});
export type DeleteBoardColumnResponse = z.infer<
  typeof DeleteBoardColumnResponseSchema
>;

export const ReorderItemsInColumnDTO = z.object({
  columnId: z.string().nullable(),
  itemOrders: z.array(
    z.object({
      id: z.string(),
      // Fractional rank — only the items whose rank actually changed are sent.
      order: z.number(),
    })
  ),
});
export type ReorderItemsInColumnDTO = z.infer<typeof ReorderItemsInColumnDTO>;

// shared/boardColumn.contract.ts
import { z } from "zod";

const trim = (v: unknown) => (typeof v === "string" ? v.trim() : v);

export const BoardColumnSchema = z.object({
  id: z.string(),
  userId: z.string(),
  name: z.string(),
  order: z.number().int().default(0),
  createdAt: z.string().datetime().or(z.date()).or(z.string()),
  updatedAt: z.string().datetime().or(z.date()).or(z.string()),
});
export type BoardColumn = z.infer<typeof BoardColumnSchema>;

export const CreateBoardColumnDTO = z.object({
  name: z.preprocess(trim, z.string().min(1, "Column name is required")),
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
  newOrder: z.number().int().min(0),
});
export type MoveItemToColumnDTO = z.infer<typeof MoveItemToColumnDTO>;

export const ReorderItemsInColumnDTO = z.object({
  columnId: z.string().nullable(),
  itemOrders: z.array(
    z.object({
      id: z.string(),
      order: z.number().int().min(0),
    })
  ),
});
export type ReorderItemsInColumnDTO = z.infer<typeof ReorderItemsInColumnDTO>;

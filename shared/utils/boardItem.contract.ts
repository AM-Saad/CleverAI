// shared/boardItem.contract.ts
import { z } from "zod";

const trim = (v: unknown) => (typeof v === "string" ? v.trim() : v);

export const BoardItemSchema = z.object({
  id: z.string(),
  userId: z.string(),
  columnId: z.string().nullable().optional(),
  content: z.string(),
  tags: z.array(z.string()).default([]),
  order: z.number().int().default(0),
  createdAt: z.string().datetime().or(z.date()).or(z.string()),
  updatedAt: z.string().datetime().or(z.date()).or(z.string()),
});
export type BoardItem = z.infer<typeof BoardItemSchema>;

export const CreateBoardItemDTO = z.object({
  content: z.preprocess(trim, z.string().min(0)),
  tags: z.array(z.string()).default([]),
  columnId: z.string().optional(),
});
export type CreateBoardItemDTO = z.infer<typeof CreateBoardItemDTO>;

export const UpdateBoardItemDTO = z.object({
  content: z.preprocess(trim, z.string().min(0)).optional(),
  tags: z.array(z.string()).optional(),
});
export type UpdateBoardItemDTO = z.infer<typeof UpdateBoardItemDTO>;

export const ReorderBoardItemsDTO = z.object({
  itemOrders: z.array(
    z.object({
      id: z.string(),
      order: z.number().int().min(0),
    })
  ),
});
export type ReorderBoardItemsDTO = z.infer<typeof ReorderBoardItemsDTO>;

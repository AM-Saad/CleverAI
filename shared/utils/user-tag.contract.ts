// shared/user-tag.contract.ts
import { z } from "zod";

const trim = (v: unknown) => (typeof v === "string" ? v.trim() : v);

export const UserTagSchema = z.object({
  id: z.string(),
  userId: z.string(),
  name: z.string(),
  color: z.string().default("#3b82f6"),
  order: z.number().int().default(0),
  createdAt: z.string().datetime().or(z.date()).or(z.string()),
  updatedAt: z.string().datetime().or(z.date()).or(z.string()),
});
export type UserTag = z.infer<typeof UserTagSchema>;

export const CreateUserTagDTO = z.object({
  name: z.preprocess(trim, z.string().min(1).max(50)),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).default("#3b82f6"),
});
export type CreateUserTagDTO = z.infer<typeof CreateUserTagDTO>;

export const UpdateUserTagDTO = z.object({
  name: z.preprocess(trim, z.string().min(1).max(50)).optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
});
export type UpdateUserTagDTO = z.infer<typeof UpdateUserTagDTO>;

export const ReorderUserTagsDTO = z.object({
  tagOrders: z.array(
    z.object({
      id: z.string(),
      order: z.number().int().min(0),
    })
  ),
});
export type ReorderUserTagsDTO = z.infer<typeof ReorderUserTagsDTO>;

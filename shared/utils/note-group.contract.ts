import { z } from "zod";

const trim = (v: unknown) => (typeof v === "string" ? v.trim() : v);

export const NoteGroupSchema = z.object({
  id: z.string(),
  workspaceId: z.string(),
  title: z.preprocess(trim, z.string().min(1)),
  order: z.number().int().default(0),
  position: z.string().regex(/^[0-9A-Za-z]+$/).optional(),
  version: z.number().int().default(1),
  createdAt: z.string().datetime().or(z.date()).or(z.string()),
  updatedAt: z.string().datetime().or(z.date()).or(z.string()),
});
export type NoteGroup = z.infer<typeof NoteGroupSchema>;

export const CreateNoteGroupDTO = z.object({
  workspaceId: z.string(),
  title: z.preprocess(trim, z.string().min(1).max(80)),
});
export type CreateNoteGroupDTO = z.infer<typeof CreateNoteGroupDTO>;

export const UpdateNoteGroupDTO = z.object({
  title: z.preprocess(trim, z.string().min(1).max(80)),
});
export type UpdateNoteGroupDTO = z.infer<typeof UpdateNoteGroupDTO>;

export const ReorderNoteGroupsDTO = z.object({
  workspaceId: z.string(),
  groupOrders: z.array(
    z.object({
      id: z.string(),
      order: z.number().int().min(0),
    }),
  ),
});
export type ReorderNoteGroupsDTO = z.infer<typeof ReorderNoteGroupsDTO>;

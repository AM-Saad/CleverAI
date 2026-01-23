// shared/note.contract.ts
import { z } from "zod";

const trim = (v: unknown) => (typeof v === "string" ? v.trim() : v);

export const NoteSchema = z.object({
  id: z.string(),
  folderId: z.string(),
  content: z.string(),
  tags: z.array(z.string()).default([]),
  order: z.number().int().default(0),
  createdAt: z.string().datetime().or(z.date()).or(z.string()),
  updatedAt: z.string().datetime().or(z.date()).or(z.string()),
});
export type Note = z.infer<typeof NoteSchema>;

export const CreateNoteDTO = z.object({
  folderId: z.string(),
  content: z.preprocess(trim, z.string().min(0)),
  tags: z.array(z.string()).default([]),
});
export type CreateNoteDTO = z.infer<typeof CreateNoteDTO>;

export const UpdateNoteDTO = z.object({
  content: z.preprocess(trim, z.string().min(0)).optional(),
  tags: z.array(z.string()).optional(),
});
export type UpdateNoteDTO = z.infer<typeof UpdateNoteDTO>;

export const ReorderNotesDTO = z.object({
  folderId: z.string(),
  noteOrders: z.array(
    z.object({
      id: z.string(),
      order: z.number().int().min(0),
    })
  ),
});
export type ReorderNotesDTO = z.infer<typeof ReorderNotesDTO>;


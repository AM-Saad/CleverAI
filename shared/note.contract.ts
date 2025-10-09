// shared/note.contract.ts
import { z } from 'zod'

const trim = (v: unknown) => (typeof v === 'string' ? v.trim() : v)

export const NoteSchema = z.object({
  id: z.string(),
  folderId: z.string(),
  content: z.string(),
  createdAt: z.string().datetime().or(z.date()).or(z.string()),
  updatedAt: z.string().datetime().or(z.date()).or(z.string()),
})
export type Note = z.infer<typeof NoteSchema>

export const CreateNoteDTO = z.object({
  folderId: z.string(),
  content: z.preprocess(trim, z.string().min(1)),
})
export type CreateNoteDTO = z.infer<typeof CreateNoteDTO>

export const UpdateNoteDTO = z.object({
  content: z.preprocess(trim, z.string().min(1)),
})
export type UpdateNoteDTO = z.infer<typeof UpdateNoteDTO>

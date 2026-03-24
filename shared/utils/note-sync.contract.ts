import { z } from "zod";

export const PendingNoteChangeSchema = z.object({
  id: z.string(), // note id
  operation: z.enum(['upsert', 'delete']),
  updatedAt: z.number().int().nonnegative(),
  localVersion: z.number().int().nonnegative(),
  workspaceId: z.string().optional(),
  content: z.string().optional(),
  tags: z.array(z.string()).optional(),
  // Handle null and empty string by normalizing to undefined
  noteType: z.preprocess(
    (val) => (val === "" || val === null || val === undefined ? undefined : val),
    z.string().optional()
  ),
  // Accept null and transform to undefined
  metadata: z.preprocess(
    (val) => (val === null ? undefined : val),
    z.record(z.string(), z.unknown()).optional()
  ),
  conflicted: z.boolean().optional(),
  type: z.string().optional(), // "FOLDER" or "BOARD"
});
export type PendingNoteChange = z.infer<typeof PendingNoteChangeSchema>;

export const NotesSyncRequestSchema = z.object({
  changes: z.array(PendingNoteChangeSchema).min(1)
});
export type NotesSyncRequest = z.infer<typeof NotesSyncRequestSchema>;

export const NotesSyncResponseSchema = z.object({
  applied: z.array(z.string()).default([]),
  conflicts: z.array(z.object({ id: z.string() })).default([])
});
export type NotesSyncResponse = z.infer<typeof NotesSyncResponseSchema>;

import { z } from "zod";

export const NoteCollabTokenResponseSchema = z.object({
  token: z.string(),
  roomName: z.string(),
  websocketUrl: z.string(),
  expiresAt: z.string(),
});
export type NoteCollabTokenResponse = z.infer<typeof NoteCollabTokenResponseSchema>;

export const NoteCollabSnapshotRequestSchema = z.object({
  content: z.string(),
  title: z.string().optional(),
});
export type NoteCollabSnapshotRequest = z.infer<typeof NoteCollabSnapshotRequestSchema>;

export const NoteCollabSnapshotResponseSchema = z.object({
  id: z.string(),
  title: z.string(),
  content: z.string(),
  version: z.number().int().nonnegative(),
  updatedAt: z.string().optional(),
});
export type NoteCollabSnapshotResponse = z.infer<typeof NoteCollabSnapshotResponseSchema>;

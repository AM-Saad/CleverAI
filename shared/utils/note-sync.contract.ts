import { z } from "zod";

export const NoteLayoutItemSchema = z.object({
  id: z.string(),
  groupId: z.string().nullable(),
  order: z.number().int().min(0),
});
export type NoteLayoutItem = z.infer<typeof NoteLayoutItemSchema>;

export const NoteGroupLayoutItemSchema = z.object({
  id: z.string(),
  order: z.number().int().min(0),
});
export type NoteGroupLayoutItem = z.infer<typeof NoteGroupLayoutItemSchema>;

export const NoteLayoutChangeSchema = z
  .object({
    id: z.string().optional(),
    workspaceId: z.string(),
    updatedAt: z.number().int().nonnegative(),
    localVersion: z.number().int().nonnegative().default(1),
    notes: z.array(NoteLayoutItemSchema).default([]),
    groups: z.array(NoteGroupLayoutItemSchema).default([]),
  })
  .transform((change) => ({
    ...change,
    id: change.id ?? change.workspaceId,
  }))
  .refine(
    (change) => change.notes.length > 0 || change.groups.length > 0,
    "Layout change must include notes or groups",
  );
export type NoteLayoutChange = z.infer<typeof NoteLayoutChangeSchema>;

export const PendingNoteChangeSchema = z.object({
  id: z.string(), // note id
  operation: z.enum(["upsert", "delete"]),
  updatedAt: z.number().int().nonnegative(),
  localVersion: z.number().int().nonnegative(),
  /** Last known server version for optimistic concurrency control */
  serverVersion: z.number().int().optional(),
  workspaceId: z.string().optional(),
  groupId: z.string().nullable().optional(),
  title: z.string().optional(),
  content: z.string().optional(),
  tags: z.array(z.string()).optional(),
  // Handle null and empty string by normalizing to undefined
  noteType: z.preprocess(
    (val) =>
      val === "" || val === null || val === undefined ? undefined : val,
    z.string().optional(),
  ),
  // Accept null and transform to undefined
  metadata: z.preprocess(
    (val) => (val === null ? undefined : val),
    z.record(z.string(), z.unknown()).optional(),
  ),
  order: z.number().int().min(0).optional(),
  rollbackData: z.record(z.string(), z.unknown()).nullable().optional(),
  conflicted: z.boolean().optional(),
  type: z.string().optional(), // "FOLDER" or "BOARD"
});
export type PendingNoteChange = z.infer<typeof PendingNoteChangeSchema>;

export const PendingNoteGroupChangeSchema = z.object({
  id: z.string(),
  operation: z.enum(["create", "rename", "delete", "reorder"]),
  workspaceId: z.string(),
  updatedAt: z.number().int().nonnegative(),
  localVersion: z.number().int().nonnegative(),
  /** Last known server version for optimistic concurrency control */
  serverVersion: z.number().int().optional(),
  title: z.string().optional(),
  order: z.number().int().min(0).optional(),
  groupOrders: z.array(NoteGroupLayoutItemSchema).optional(),
  conflicted: z.boolean().optional(),
  rollbackData: z.record(z.string(), z.unknown()).nullable().optional(),
});
export type PendingNoteGroupChange = z.infer<
  typeof PendingNoteGroupChangeSchema
>;

export const NoteConflictSnapshotSchema = z.object({
  id: z.string(),
  workspaceId: z.string(),
  groupId: z.string().nullable().optional(),
  title: z.string().optional(),
  content: z.string().optional(),
  tags: z.array(z.string()).optional(),
  noteType: z.string().optional(),
  metadata: z.unknown().optional(),
  version: z.number().int().nonnegative().optional(),
  updatedAt: z.string().optional(),
});
export type NoteConflictSnapshot = z.infer<typeof NoteConflictSnapshotSchema>;

export const NotesSyncRequestSchema = z
  .object({
    changes: z.array(PendingNoteChangeSchema).default([]),
    contentChanges: z.array(PendingNoteChangeSchema).default([]),
    groupChanges: z.array(PendingNoteGroupChangeSchema).default([]),
    layoutChange: NoteLayoutChangeSchema.optional(),
  })
  .transform((request) => ({
    ...request,
    changes: [...request.changes, ...request.contentChanges],
  }))
  .refine(
    (request) =>
      request.changes.length > 0 ||
      request.groupChanges.length > 0 ||
      Boolean(request.layoutChange),
    {
      message:
        "Sync request must include note changes, group changes, or a layout change",
    },
  );
export type NotesSyncRequest = z.infer<typeof NotesSyncRequestSchema>;

export const NotesSyncResponseSchema = z
  .object({
    applied: z.array(z.string()).default([]),
    appliedNotes: z
      .array(
        z.object({
          id: z.string(),
          version: z.number().int().nonnegative(),
          updatedAt: z.string().optional(),
        }),
      )
      .default([]),
    conflicts: z
      .array(
        z.object({
          id: z.string(),
          reason: z.string().optional(),
          resolution: z.string().optional(),
          serverVersion: z.number().int().nonnegative().optional(),
          clientServerVersion: z.number().int().nonnegative().optional(),
          serverSnapshot: NoteConflictSnapshotSchema.optional(),
        }),
      )
      .default([]),
    idMap: z.record(z.string(), z.string()).default({}),
    noteIdMap: z.record(z.string(), z.string()).default({}),
    replayedCreates: z.array(z.string()).default([]),
    groupApplied: z.array(z.string()).default([]),
    groupConflicts: z.array(z.object({ id: z.string() })).default([]),
    groupIdMap: z.record(z.string(), z.string()).default({}),
    replayedGroupCreates: z.array(z.string()).default([]),
    errors: z
      .array(
        z.object({
          scope: z.string(),
          id: z.string().optional(),
          message: z.string(),
        }),
      )
      .default([]),
    layoutApplied: z.boolean().default(false),
    layoutConflict: z.boolean().default(false),
  })
  .transform((response) => ({
    ...response,
    noteIdMap: Object.keys(response.noteIdMap).length
      ? response.noteIdMap
      : response.idMap,
    idMap: Object.keys(response.idMap).length
      ? response.idMap
      : response.noteIdMap,
  }));
export type NotesSyncResponse = z.infer<typeof NotesSyncResponseSchema>;

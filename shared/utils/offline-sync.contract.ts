import { z } from "zod";

/**
 * The v2 offline protocol deliberately transports mutations rather than HTTP
 * requests.  A mutation is safe to retain, replay and inspect without
 * exposing credentials or depending on an endpoint's former request shape.
 */
export const OfflineEntitySchema = z.enum([
  "workspace",
  "note",
  "noteGroup",
  "boardItem",
  "boardColumn",
  "boardComment",
  "boardLink",
  "userTag",
  "material",
  "languageWord",
  "languagePreference",
  "notificationPreference",
  "review",
  "languageReview",
  "studyContent",
  "dailyNote",
  "actionItem",
  "actionOccurrence",
  "actionPlacement",
]);
export type OfflineEntity = z.infer<typeof OfflineEntitySchema>;

export const OfflineMutationStatusSchema = z.enum([
  "pending",
  "syncing",
  "retry",
  /** The account must authenticate before this mutation can be sent again. */
  "blocked",
  "rejected",
  "conflict",
]);
export type OfflineMutationStatus = z.infer<typeof OfflineMutationStatusSchema>;

export const OfflineMutationSchema = z.object({
  id: z.string().min(1),
  entity: OfflineEntitySchema,
  operation: z.string().min(3).max(80),
  entityId: z.string().min(1),
  workspaceId: z.string().min(1).optional(),
  baseVersion: z.number().int().nonnegative().optional(),
  changedFields: z.array(z.string().min(1)).max(64).default([]),
  payload: z.record(z.string(), z.unknown()).default({}),
  /** Canonical local snapshot from before this coalesced command began. */
  rollbackData: z.record(z.string(), z.unknown()).nullable().optional(),
  dependsOn: z.array(z.string().min(1)).max(32).default([]),
  occurredAt: z.string().datetime(),
  createdAt: z.number().int().nonnegative(),
  attempts: z.number().int().nonnegative().default(0),
  status: OfflineMutationStatusSchema.default("pending"),
  lastError: z.string().max(1000).optional(),
  /** Grades and other audit events must never be coalesced. */
  sequence: z.boolean().default(false),
});
export type OfflineMutation = z.infer<typeof OfflineMutationSchema>;

export const OfflineConflictSchema = z.object({
  entity: OfflineEntitySchema,
  entityId: z.string(),
  serverVersion: z.number().int().nonnegative(),
  overlappingFields: z.array(z.string()),
  serverSnapshot: z.record(z.string(), z.unknown()).nullable().optional(),
  reason: z.string(),
});
export type OfflineConflict = z.infer<typeof OfflineConflictSchema>;

export const OfflineRelatedEntityResultSchema = z.object({
  entity: OfflineEntitySchema,
  entityId: z.string(),
  version: z.number().int().nonnegative(),
  canonical: z.record(z.string(), z.unknown()).nullable().optional(),
});
export type OfflineRelatedEntityResult = z.infer<typeof OfflineRelatedEntityResultSchema>;

export const OfflineSyncResultSchema = z.object({
  id: z.string(),
  status: z.enum(["applied", "retry", "rejected", "conflict"]),
  entity: OfflineEntitySchema.optional(),
  entityId: z.string().optional(),
  version: z.number().int().nonnegative().optional(),
  canonical: z.record(z.string(), z.unknown()).nullable().optional(),
  idMap: z.record(z.string(), z.string()).optional(),
  related: z.array(OfflineRelatedEntityResultSchema).optional(),
  conflict: OfflineConflictSchema.optional(),
  message: z.string().optional(),
});
export type OfflineSyncResult = z.infer<typeof OfflineSyncResultSchema>;

export const OfflineSyncRequestSchema = z.object({
  clientId: z.string().min(1).max(128),
  // Keep this deliberately small: results are applied one batch at a time so a
  // bad record cannot strand an unbounded outbox behind it.
  mutations: z.array(OfflineMutationSchema).min(1).max(50),
});
export type OfflineSyncRequest = z.infer<typeof OfflineSyncRequestSchema>;

export const OfflineSyncResponseSchema = z.object({
  serverTime: z.string().datetime(),
  results: z.array(OfflineSyncResultSchema),
});
export type OfflineSyncResponse = z.infer<typeof OfflineSyncResponseSchema>;

export const OfflinePackSchema = z.object({
  id: z.string(),
  accountId: z.string(),
  workspaceId: z.string().nullable(),
  revision: z.string(),
  downloadedAt: z.number().int(),
  updatedAt: z.number().int(),
  status: z.enum(["downloading", "ready", "failed"]),
  bytes: z.number().int().nonnegative().default(0),
  failures: z.array(z.string()).default([]),
});
export type OfflinePack = z.infer<typeof OfflinePackSchema>;

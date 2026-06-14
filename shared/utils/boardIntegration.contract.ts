import { z } from "zod";

export const BOARD_INTEGRATION_PROVIDERS = ["jira", "notion"] as const;
export const BOARD_INTEGRATION_SYNC_DIRECTIONS = [
  "IMPORT_ONLY",
  "PUSH_ONLY",
  "TWO_WAY",
] as const;
export const BOARD_INTEGRATION_REF_STATUSES = [
  "SYNCED",
  "PENDING",
  "CONFLICT",
  "ERROR",
] as const;

export type BoardIntegrationProvider =
  (typeof BOARD_INTEGRATION_PROVIDERS)[number];
export type BoardIntegrationSyncDirection =
  (typeof BOARD_INTEGRATION_SYNC_DIRECTIONS)[number];
export type BoardIntegrationRefStatus =
  (typeof BOARD_INTEGRATION_REF_STATUSES)[number];

export const BoardIntegrationProviderSchema = z.enum(
  BOARD_INTEGRATION_PROVIDERS,
);

const JsonRecordSchema = z.record(z.string(), z.unknown());

export const BoardIntegrationAccountSchema = z.object({
  id: z.string(),
  provider: BoardIntegrationProviderSchema,
  externalAccountId: z.string(),
  displayName: z.string(),
  accountUrl: z.string().url().nullable().optional(),
  scopes: z.array(z.string()).default([]),
  metadata: JsonRecordSchema.default({}),
  createdAt: z.string().datetime().or(z.date()).or(z.string()),
  updatedAt: z.string().datetime().or(z.date()).or(z.string()),
});
export type BoardIntegrationAccount = z.infer<
  typeof BoardIntegrationAccountSchema
>;

export const ExternalBoardSourceSchema = z.object({
  provider: BoardIntegrationProviderSchema,
  accountId: z.string(),
  id: z.string(),
  key: z.string().optional(),
  name: z.string(),
  url: z.string().url().nullable().optional(),
  metadata: JsonRecordSchema.default({}),
});
export type ExternalBoardSource = z.infer<typeof ExternalBoardSourceSchema>;

export const ExternalBoardMappingSchema = z.object({
  id: z.string(),
  workspaceId: z.string(),
  accountId: z.string(),
  provider: BoardIntegrationProviderSchema,
  externalContainerId: z.string(),
  externalContainerKey: z.string().nullable().optional(),
  name: z.string(),
  syncDirection: z.enum(BOARD_INTEGRATION_SYNC_DIRECTIONS).default("IMPORT_ONLY"),
  fieldMapping: JsonRecordSchema.default({}),
  status: z.string().default("ACTIVE"),
  lastSyncedAt: z.string().datetime().or(z.date()).or(z.string()).nullable().optional(),
  lastError: z.string().nullable().optional(),
  createdAt: z.string().datetime().or(z.date()).or(z.string()),
  updatedAt: z.string().datetime().or(z.date()).or(z.string()),
});
export type ExternalBoardMapping = z.infer<typeof ExternalBoardMappingSchema>;

export const BoardItemExternalRefSchema = z.object({
  id: z.string(),
  itemId: z.string(),
  accountId: z.string(),
  mappingId: z.string().nullable().optional(),
  provider: BoardIntegrationProviderSchema,
  externalId: z.string(),
  externalKey: z.string().nullable().optional(),
  externalUrl: z.string().url().nullable().optional(),
  externalUpdatedAt: z.string().datetime().or(z.date()).or(z.string()).nullable().optional(),
  syncStatus: z.enum(BOARD_INTEGRATION_REF_STATUSES).default("SYNCED"),
  lastSyncedAt: z.string().datetime().or(z.date()).or(z.string()).nullable().optional(),
  lastError: z.string().nullable().optional(),
  raw: JsonRecordSchema.nullable().optional(),
  createdAt: z.string().datetime().or(z.date()).or(z.string()),
  updatedAt: z.string().datetime().or(z.date()).or(z.string()),
});
export type BoardItemExternalRef = z.infer<typeof BoardItemExternalRefSchema>;

export const CreateExternalBoardMappingDTO = z.object({
  workspaceId: z.string(),
  accountId: z.string(),
  externalContainerId: z.string(),
  externalContainerKey: z.string().optional(),
  name: z.string().min(1),
  syncDirection: z.enum(BOARD_INTEGRATION_SYNC_DIRECTIONS).default("IMPORT_ONLY"),
  fieldMapping: JsonRecordSchema.default({}),
});
export type CreateExternalBoardMappingDTO = z.infer<
  typeof CreateExternalBoardMappingDTO
>;

export const ImportExternalBoardDTO = CreateExternalBoardMappingDTO.extend({
  mappingId: z.string().optional(),
  limit: z.number().int().min(1).max(100).default(50),
});
export type ImportExternalBoardDTO = z.infer<typeof ImportExternalBoardDTO>;

export const ImportExternalBoardResponseSchema = z.object({
  mapping: ExternalBoardMappingSchema,
  created: z.number().int().default(0),
  updated: z.number().int().default(0),
  conflicted: z.number().int().default(0),
  skipped: z.number().int().default(0),
  refs: z.array(BoardItemExternalRefSchema).default([]),
});
export type ImportExternalBoardResponse = z.infer<
  typeof ImportExternalBoardResponseSchema
>;

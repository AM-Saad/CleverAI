import { z } from "zod";

export const INTEGRATION_PROVIDERS = ["jira", "notion"] as const;
export const INTEGRATION_TARGETS = ["BOARD_ITEM", "NOTE"] as const;
export const EXTERNAL_CONTENT_KINDS = ["TASK", "DOCUMENT"] as const;
export const WORKSPACE_INTEGRATION_REF_STATUSES = [
  "SYNCED",
  "PENDING",
  "CONFLICT",
  "ERROR",
  "LOCAL_CHANGED",
] as const;

export type IntegrationProvider = (typeof INTEGRATION_PROVIDERS)[number];
export type IntegrationTarget = (typeof INTEGRATION_TARGETS)[number];
export type ExternalContentKind = (typeof EXTERNAL_CONTENT_KINDS)[number];
export type WorkspaceIntegrationRefStatus =
  (typeof WORKSPACE_INTEGRATION_REF_STATUSES)[number];

const JsonRecordSchema = z.record(z.string(), z.unknown());
const DateishSchema = z.string().datetime().or(z.date()).or(z.string());

export const IntegrationProviderSchema = z.enum(INTEGRATION_PROVIDERS);
export const IntegrationTargetSchema = z.enum(INTEGRATION_TARGETS);
export const ExternalContentKindSchema = z.enum(EXTERNAL_CONTENT_KINDS);
export const WorkspaceIntegrationRefStatusSchema = z.enum(
  WORKSPACE_INTEGRATION_REF_STATUSES,
);

export const WorkspaceIntegrationAccountSchema = z.object({
  id: z.string(),
  provider: IntegrationProviderSchema,
  externalAccountId: z.string(),
  displayName: z.string(),
  accountUrl: z.string().url().nullable().optional(),
  scopes: z.array(z.string()).default([]),
  metadata: JsonRecordSchema.default({}),
  createdAt: DateishSchema,
  updatedAt: DateishSchema,
});
export type WorkspaceIntegrationAccount = z.infer<
  typeof WorkspaceIntegrationAccountSchema
>;

export const ExternalSourceSchema = z.object({
  provider: IntegrationProviderSchema,
  accountId: z.string(),
  id: z.string(),
  key: z.string().optional(),
  name: z.string(),
  url: z.string().url().nullable().optional(),
  supportedKinds: z.array(ExternalContentKindSchema).default([]),
  defaultTarget: IntegrationTargetSchema.nullable().optional(),
  metadata: JsonRecordSchema.default({}),
});
export type ExternalSource = z.infer<typeof ExternalSourceSchema>;

export const ExternalTaskSchema = z.object({
  provider: IntegrationProviderSchema,
  externalId: z.string(),
  externalKey: z.string().nullable().optional(),
  externalUrl: z.string().url().nullable().optional(),
  title: z.string(),
  status: z.string().nullable().optional(),
  tags: z.array(z.string()).default([]),
  dueDate: z.string().nullable().optional(),
  updatedAt: z.string().nullable().optional(),
  raw: JsonRecordSchema.default({}),
});
export type ExternalTask = z.infer<typeof ExternalTaskSchema>;

export const ExternalDocumentSchema = z.object({
  provider: IntegrationProviderSchema,
  externalId: z.string(),
  externalKey: z.string().nullable().optional(),
  externalUrl: z.string().url().nullable().optional(),
  title: z.string(),
  htmlContent: z.string(),
  plainText: z.string(),
  updatedAt: z.string().nullable().optional(),
  metadata: JsonRecordSchema.default({}),
  raw: JsonRecordSchema.default({}),
});
export type ExternalDocument = z.infer<typeof ExternalDocumentSchema>;

export const ExternalTaskPageSchema = z.object({
  items: z.array(ExternalTaskSchema).default([]),
  nextCursor: z.string().nullable().optional(),
  warnings: z.array(z.string()).default([]),
});
export type ExternalTaskPage = z.infer<typeof ExternalTaskPageSchema>;

export const ExternalDocumentPageSchema = z.object({
  items: z.array(ExternalDocumentSchema).default([]),
  nextCursor: z.string().nullable().optional(),
  warnings: z.array(z.string()).default([]),
});
export type ExternalDocumentPage = z.infer<typeof ExternalDocumentPageSchema>;

export const WorkspaceExternalMappingSchema = z.object({
  id: z.string(),
  workspaceId: z.string(),
  accountId: z.string(),
  provider: IntegrationProviderSchema,
  externalSourceId: z.string(),
  externalSourceKey: z.string().nullable().optional(),
  sourceKind: z.string(),
  targetType: IntegrationTargetSchema,
  targetGroupId: z.string().nullable().optional(),
  name: z.string(),
  fieldMapping: JsonRecordSchema.default({}),
  importOptions: JsonRecordSchema.default({}),
  status: z.string().default("ACTIVE"),
  lastSyncedAt: DateishSchema.nullable().optional(),
  lastError: z.string().nullable().optional(),
  createdAt: DateishSchema,
  updatedAt: DateishSchema,
});
export type WorkspaceExternalMapping = z.infer<
  typeof WorkspaceExternalMappingSchema
>;

export const WorkspaceExternalRefSchema = z.object({
  id: z.string(),
  workspaceId: z.string(),
  accountId: z.string(),
  mappingId: z.string().nullable().optional(),
  targetType: IntegrationTargetSchema,
  targetId: z.string(),
  provider: IntegrationProviderSchema,
  externalId: z.string(),
  externalKey: z.string().nullable().optional(),
  externalUrl: z.string().url().nullable().optional(),
  externalUpdatedAt: DateishSchema.nullable().optional(),
  syncStatus: WorkspaceIntegrationRefStatusSchema.default("SYNCED"),
  lastSyncedAt: DateishSchema.nullable().optional(),
  lastError: z.string().nullable().optional(),
  raw: JsonRecordSchema.nullable().optional(),
  createdAt: DateishSchema,
  updatedAt: DateishSchema,
});
export type WorkspaceExternalRef = z.infer<typeof WorkspaceExternalRefSchema>;

export const PreviewWorkspaceImportDTO = z.object({
  workspaceId: z.string(),
  accountId: z.string(),
  sourceId: z.string(),
  sourceKey: z.string().nullable().optional(),
  targetType: IntegrationTargetSchema.nullable().optional(),
  contentKinds: z.array(ExternalContentKindSchema).optional(),
  limit: z.number().int().min(1).max(25).default(10),
  fieldMapping: JsonRecordSchema.default({}),
  importOptions: JsonRecordSchema.default({}),
});
export type PreviewWorkspaceImportDTO = z.infer<
  typeof PreviewWorkspaceImportDTO
>;

export const RunWorkspaceImportDTO = z.object({
  workspaceId: z.string(),
  accountId: z.string(),
  mappingId: z.string().optional(),
  sourceId: z.string(),
  sourceKey: z.string().nullable().optional(),
  sourceName: z.string().optional(),
  targetType: IntegrationTargetSchema,
  contentKinds: z.array(ExternalContentKindSchema).min(1),
  noteGroupId: z.string().nullable().optional(),
  noteGroupTitle: z.string().optional(),
  limit: z.number().int().min(1).max(100).default(50),
  fieldMapping: JsonRecordSchema.default({}),
  importOptions: JsonRecordSchema.default({}),
});
export type RunWorkspaceImportDTO = z.infer<typeof RunWorkspaceImportDTO>;

export const RefreshWorkspaceImportDTO = z.object({
  mappingId: z.string(),
});
export type RefreshWorkspaceImportDTO = z.infer<
  typeof RefreshWorkspaceImportDTO
>;

export const WorkspaceImportRefResultSchema = z.object({
  id: z.string(),
  targetType: IntegrationTargetSchema,
  targetId: z.string(),
  externalId: z.string(),
  externalKey: z.string().nullable().optional(),
  syncStatus: WorkspaceIntegrationRefStatusSchema,
  lastError: z.string().nullable().optional(),
});
export type WorkspaceImportRefResult = z.infer<
  typeof WorkspaceImportRefResultSchema
>;

export const PreviewWorkspaceImportResponseSchema = z.object({
  source: ExternalSourceSchema.optional(),
  tasks: z.array(ExternalTaskSchema).default([]),
  documents: z.array(
    ExternalDocumentSchema.omit({ htmlContent: true, raw: true }).extend({
      excerpt: z.string().optional(),
    }),
  ).default([]),
  warnings: z.array(z.string()).default([]),
});
export type PreviewWorkspaceImportResponse = z.infer<
  typeof PreviewWorkspaceImportResponseSchema
>;

export const RunWorkspaceImportResponseSchema = z.object({
  mapping: WorkspaceExternalMappingSchema,
  created: z.number().int().default(0),
  updated: z.number().int().default(0),
  conflicted: z.number().int().default(0),
  skipped: z.number().int().default(0),
  warnings: z.array(z.string()).default([]),
  refs: z.array(WorkspaceImportRefResultSchema).default([]),
});
export type RunWorkspaceImportResponse = z.infer<
  typeof RunWorkspaceImportResponseSchema
>;

export const WorkspaceImportMappingSummarySchema = WorkspaceExternalMappingSchema.extend({
  refCounts: z.object({
    total: z.number().int().default(0),
    synced: z.number().int().default(0),
    localChanged: z.number().int().default(0),
    conflicted: z.number().int().default(0),
    error: z.number().int().default(0),
  }),
});
export type WorkspaceImportMappingSummary = z.infer<
  typeof WorkspaceImportMappingSummarySchema
>;

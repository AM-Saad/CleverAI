// shared/workspace.contract.ts
import { z } from "zod";
import { LLMEnum } from "./llm";

const trim = (v: unknown) => (typeof v === "string" ? v.trim() : v);
const dateish = z.string().datetime().or(z.date()).or(z.string());

export const WorkspaceSummarySchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string().nullable(),
  metadata: z.record(z.string(), z.unknown()).nullable(),
  order: z.number(),
  position: z.string().regex(/^[0-9A-Za-z]+$/).optional(),
  llmModel: LLMEnum,
  createdAt: dateish,
  updatedAt: dateish,
});
export type WorkspaceSummary = z.infer<typeof WorkspaceSummarySchema>;

// Lightweight relation schemas (DB rows or generated DTOs). Passthrough preserves extra fields.
const WorkspaceFlashcardRelation = z
  .object({
    id: z.string().optional(),
    // Support either DB naming (question/answer) or generated DTO (front/back)
    question: z.string().optional(),
    answer: z.string().optional(),
    front: z.string().optional(),
    back: z.string().optional(),
    createdAt: z.string().datetime().or(z.date()).or(z.string()).optional(),
    updatedAt: z.string().datetime().or(z.date()).or(z.string()).optional(),
  })
  .passthrough();

const WorkspaceQuestionRelation = z
  .object({
    id: z.string().optional(),
    question: z.string(),
    choices: z.array(z.string()),
    answerIndex: z.number().int().nonnegative().optional(),
    createdAt: z.string().datetime().or(z.date()).or(z.string()).optional(),
    updatedAt: z.string().datetime().or(z.date()).or(z.string()).optional(),
  })
  .passthrough();

const WorkspaceMaterialRelation = z
  .object({
    id: z.string().optional(),
    title: z.string(),
    content: z.string(),
    type: z.string().nullable().optional(),
    metadata: z.record(z.string(), z.unknown()).nullable().optional(),
    llmModel: z.string().nullable().optional(),
    llmPrompt: z.string().nullable().optional(),
    createdAt: z.string().datetime().or(z.date()).or(z.string()).optional(),
    updatedAt: z.string().datetime().or(z.date()).or(z.string()).optional(),
  })
  .passthrough();

export const WorkspaceSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string().nullable(),
  userId: z.string(),
  metadata: z.record(z.string(), z.unknown()).nullable(),
  order: z.number().optional(),
  position: z.string().regex(/^[0-9A-Za-z]+$/).optional(),
  rawText: z.string().nullable().optional(), // Keep for backward compatibility, but deprecated
  llmModel: LLMEnum,
  createdAt: dateish,
  updatedAt: dateish,
  flashcards: z.array(WorkspaceFlashcardRelation).optional(),
  questions: z.array(WorkspaceQuestionRelation).optional(),
  materials: z.array(WorkspaceMaterialRelation).optional(),
});
export type Workspace = z.infer<typeof WorkspaceSchema>;

export const WorkspaceStudyFlashcardSchema = z
  .object({
    id: z.string(),
    workspaceId: z.string(),
    materialId: z.string().nullable().optional(),
    front: z.string(),
    back: z.string(),
    sourceRef: z.unknown().nullable().optional(),
    status: z.string().optional(),
    createdAt: dateish,
    updatedAt: dateish,
  })
  .passthrough();

export const WorkspaceStudyQuestionSchema = z
  .object({
    id: z.string(),
    workspaceId: z.string(),
    materialId: z.string().nullable().optional(),
    type: z.string().optional(),
    question: z.string(),
    choices: z.array(z.string()),
    answerIndex: z.number().int().nonnegative(),
    sourceRef: z.unknown().nullable().optional(),
    status: z.string().optional(),
    createdAt: dateish,
    updatedAt: dateish,
  })
  .passthrough();

export const WorkspaceStudyContentSchema = z.object({
  flashcards: z.array(WorkspaceStudyFlashcardSchema),
  questions: z.array(WorkspaceStudyQuestionSchema),
});
export type WorkspaceStudyContent = z.infer<typeof WorkspaceStudyContentSchema>;

export const CreateWorkspaceDTO = z.object({
  title: z.preprocess(trim, z.string().min(1)),
  description: z.preprocess(trim, z.string()).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});
export type CreateWorkspaceDTO = z.infer<typeof CreateWorkspaceDTO>;

export const UpdateWorkspaceDTO = z.object({
  id: z.string(),
  title: z.preprocess(trim, z.string()).optional(),
  description: z.preprocess(trim, z.string()).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
  rawText: z.preprocess(trim, z.string()).optional(), // Deprecated, use materials instead
  order: z.number().optional(),
  // Add material content directly to workspace update for convenience
  materialContent: z.preprocess(trim, z.string()).optional(),
  materialTitle: z.preprocess(trim, z.string()).optional(),
  materialType: z.string().optional(),
});
export type UpdateWorkspaceDTO = z.infer<typeof UpdateWorkspaceDTO>;

// shared/folder.contract.ts
import { z } from "zod";
import { LLMEnum } from "./llm";

const trim = (v: unknown) => (typeof v === "string" ? v.trim() : v);

// Lightweight relation schemas (DB rows or generated DTOs). Passthrough preserves extra fields.
const FolderFlashcardRelation = z
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

const FolderQuestionRelation = z
  .object({
    id: z.string().optional(),
    question: z.string(),
    choices: z.array(z.string()),
    answerIndex: z.number().int().nonnegative().optional(),
    createdAt: z.string().datetime().or(z.date()).or(z.string()).optional(),
    updatedAt: z.string().datetime().or(z.date()).or(z.string()).optional(),
  })
  .passthrough();

const FolderMaterialRelation = z
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

export const FolderSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string().nullable(),
  userId: z.string(),
  metadata: z.record(z.string(), z.unknown()).nullable(),
  rawText: z.string().nullable().optional(), // Keep for backward compatibility, but deprecated
  llmModel: LLMEnum,
  createdAt: z.string().datetime().or(z.date()).or(z.string()),
  updatedAt: z.string().datetime().or(z.date()).or(z.string()),
  flashcards: z.array(FolderFlashcardRelation).optional(),
  questions: z.array(FolderQuestionRelation).optional(),
  materials: z.array(FolderMaterialRelation).optional(),
});
export type Folder = z.infer<typeof FolderSchema>;

export const CreateFolderDTO = z.object({
  title: z.preprocess(trim, z.string().min(1)),
  description: z.preprocess(trim, z.string()).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});
export type CreateFolderDTO = z.infer<typeof CreateFolderDTO>;

export const UpdateFolderDTO = z.object({
  id: z.string(),
  title: z.preprocess(trim, z.string()).optional(),
  description: z.preprocess(trim, z.string()).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
  rawText: z.preprocess(trim, z.string()).optional(), // Deprecated, use materials instead
  order: z.number().optional(),
  // Add material content directly to folder update for convenience
  materialContent: z.preprocess(trim, z.string()).optional(),
  materialTitle: z.preprocess(trim, z.string()).optional(),
  materialType: z.string().optional(),
});
export type UpdateFolderDTO = z.infer<typeof UpdateFolderDTO>;

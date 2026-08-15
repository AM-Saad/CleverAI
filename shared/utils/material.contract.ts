// shared/material.contract.ts
import { z } from "zod";
import { LLMEnum } from "./llm";
import { SourceRefSchema } from "./flashcard.contract";

const trim = (v: unknown) => (typeof v === "string" ? v.trim() : v);

export const MaterialTypeEnum = z.enum([
  "text",
  "video",
  "audio",
  "pdf",
  "docx",
  "txt",
  "url",
  "document",
]);
export type MaterialType = z.infer<typeof MaterialTypeEnum>;

export const MaterialSchema = z.object({
  id: z.string(),
  workspaceId: z.string(),
  title: z.string(),
  content: z.string(),
  type: MaterialTypeEnum.nullable().optional(),
  metadata: z.record(z.string(), z.unknown()).nullable().optional(),
  llmModel: z.string().nullable().optional(),
  llmPrompt: z.string().nullable().optional(),
  createdAt: z.string().datetime().or(z.date()).or(z.string()),
  updatedAt: z.string().datetime().or(z.date()).or(z.string()),
});
export type Material = z.infer<typeof MaterialSchema>;

export const MaterialSummarySchema = MaterialSchema.omit({
  content: true,
  llmModel: true,
  llmPrompt: true,
});
export type MaterialSummary = z.infer<typeof MaterialSummarySchema>;

export const MaterialLibraryTypeFilterEnum = z.enum([
  "all",
  "pdf",
  "docx",
  "txt",
  "other",
]);
export type MaterialLibraryTypeFilter = z.infer<
  typeof MaterialLibraryTypeFilterEnum
>;

export const MaterialLibrarySortEnum = z.enum(["newest", "name"]);
export type MaterialLibrarySort = z.infer<typeof MaterialLibrarySortEnum>;

export const MaterialLibraryQuerySchema = z.object({
  workspaceId: z
    .string()
    .regex(
      /^[0-9a-fA-F]{24}$/,
      "Workspace ID must be a valid MongoDB ObjectId",
    ),
  search: z.preprocess(
    trim,
    z.string().max(120, "Search is too long").default(""),
  ),
  type: MaterialLibraryTypeFilterEnum.default("all"),
  sort: MaterialLibrarySortEnum.default("newest"),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  cursor: z
    .string()
    .regex(/^[0-9a-fA-F]{24}$/, "Cursor must be a valid MongoDB ObjectId")
    .optional(),
});
export type MaterialLibraryQuery = z.infer<typeof MaterialLibraryQuerySchema>;

export const MaterialLibraryPageSchema = z.object({
  items: z.array(MaterialSummarySchema),
  total: z.number().int().nonnegative(),
  nextCursor: z.string().nullable(),
  hasMore: z.boolean(),
});
export type MaterialLibraryPage = z.infer<typeof MaterialLibraryPageSchema>;

export const MaterialGeneratedFlashcardSchema = z.object({
  id: z.string(),
  front: z.string(),
  back: z.string(),
  sourceRef: SourceRefSchema.nullable().optional(),
  status: z.string(),
  createdAt: z.string().datetime().or(z.date()).or(z.string()),
  updatedAt: z.string().datetime().or(z.date()).or(z.string()),
});
export type MaterialGeneratedFlashcard = z.infer<
  typeof MaterialGeneratedFlashcardSchema
>;

export const MaterialGeneratedQuestionSchema = z.object({
  id: z.string(),
  question: z.string(),
  choices: z.array(z.string()),
  answerIndex: z.number().int().nonnegative(),
  sourceRef: SourceRefSchema.nullable().optional(),
  status: z.string(),
  createdAt: z.string().datetime().or(z.date()).or(z.string()),
  updatedAt: z.string().datetime().or(z.date()).or(z.string()),
});
export type MaterialGeneratedQuestion = z.infer<
  typeof MaterialGeneratedQuestionSchema
>;

export const MaterialGeneratedContentSchema = z.object({
  flashcardsCount: z.number().int().nonnegative(),
  questionsCount: z.number().int().nonnegative(),
  flashcards: z.array(MaterialGeneratedFlashcardSchema),
  questions: z.array(MaterialGeneratedQuestionSchema),
});
export type MaterialGeneratedContent = z.infer<
  typeof MaterialGeneratedContentSchema
>;

export const CreateMaterialDTO = z.object({
  workspaceId: z.string(),
  title: z.preprocess(trim, z.string().min(1).max(240)),
  content: z.preprocess(trim, z.string().min(1)),
  type: MaterialTypeEnum.optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
  llmModel: LLMEnum.optional(),
  llmPrompt: z.preprocess(trim, z.string()).optional(),
});
export type CreateMaterialDTO = z.infer<typeof CreateMaterialDTO>;

export const UpdateMaterialDTO = z.object({
  title: z.preprocess(trim, z.string().min(1).max(240)).optional(),
  content: z.preprocess(trim, z.string().min(1)).optional(),
  type: MaterialTypeEnum.optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
  llmModel: LLMEnum.optional(),
  llmPrompt: z.preprocess(trim, z.string()).optional(),
});
export type UpdateMaterialDTO = z.infer<typeof UpdateMaterialDTO>;

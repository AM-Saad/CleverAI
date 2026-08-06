// shared/material.contract.ts
import { z } from "zod";
import { LLMEnum } from "./llm";

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

export const MaterialGeneratedFlashcardSchema = z.object({
  id: z.string(),
  front: z.string(),
  back: z.string(),
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

// shared/material.contract.ts
import { z } from "zod";
import { LLMEnum } from "./llm";

const trim = (v: unknown) => (typeof v === "string" ? v.trim() : v);

export const MaterialTypeEnum = z.enum([
  "text",
  "video",
  "audio",
  "pdf",
  "url",
  "document",
]);
export type MaterialType = z.infer<typeof MaterialTypeEnum>;

export const MaterialSchema = z.object({
  id: z.string(),
  folderId: z.string(),
  title: z.string(),
  content: z.string(),
  type: z.string().nullable().optional(),
  metadata: z.record(z.string(), z.unknown()).nullable().optional(),
  llmModel: z.string().nullable().optional(),
  llmPrompt: z.string().nullable().optional(),
  createdAt: z.string().datetime().or(z.date()).or(z.string()),
  updatedAt: z.string().datetime().or(z.date()).or(z.string()),
});
export type Material = z.infer<typeof MaterialSchema>;

export const CreateMaterialDTO = z.object({
  folderId: z.string(),
  title: z.preprocess(trim, z.string().min(1)),
  content: z.preprocess(trim, z.string().min(1)),
  type: MaterialTypeEnum.optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
  llmModel: LLMEnum.optional(),
  llmPrompt: z.preprocess(trim, z.string()).optional(),
});
export type CreateMaterialDTO = z.infer<typeof CreateMaterialDTO>;

export const UpdateMaterialDTO = z.object({
  title: z.preprocess(trim, z.string().min(1)).optional(),
  content: z.preprocess(trim, z.string().min(1)).optional(),
  type: MaterialTypeEnum.optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
  llmModel: LLMEnum.optional(),
  llmPrompt: z.preprocess(trim, z.string()).optional(),
});
export type UpdateMaterialDTO = z.infer<typeof UpdateMaterialDTO>;

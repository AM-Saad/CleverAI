// shared/utils/flashcard.contract.ts
import { z } from "zod";

const trim = (v: unknown) => (typeof v === "string" ? v.trim() : v);

// ==========================================
// Source Reference Schema
// ==========================================

export const SourceRefSchema = z.object({
  type: z.enum(["NOTE", "PDF"]),
  materialId: z.string().optional(),
  anchor: z.string(), // blockId or page number
});
export type SourceRef = z.infer<typeof SourceRefSchema>;

// ==========================================
// Flashcard Schema (DB model)
// ==========================================

export const FlashcardSchema = z.object({
  id: z.string(),
  folderId: z.string(),
  materialId: z.string().nullable(),
  front: z.string(),
  back: z.string(),
  sourceRef: SourceRefSchema.nullable().optional(),
  status: z.enum(["DRAFT", "ENROLLED"]).default("DRAFT"),
  createdAt: z.string().datetime().or(z.date()).or(z.string()),
  updatedAt: z.string().datetime().or(z.date()).or(z.string()),
});
export type Flashcard = z.infer<typeof FlashcardSchema>;

// ==========================================
// Create Flashcard DTO
// ==========================================

export const CreateFlashcardDTO = z.object({
  folderId: z.string().min(1, "Folder ID is required"),
  front: z.preprocess(
    trim,
    z.string().min(1, "Front content is required").max(2000)
  ),
  back: z.preprocess(
    trim,
    z.string().min(1, "Back content is required").max(5000)
  ),
  materialId: z.string().optional(),
});
export type CreateFlashcardDTO = z.infer<typeof CreateFlashcardDTO>;

// ==========================================
// Update Flashcard DTO
// ==========================================

export const UpdateFlashcardDTO = z.object({
  front: z
    .preprocess(trim, z.string().min(1, "Front content is required").max(2000))
    .optional(),
  back: z
    .preprocess(trim, z.string().min(1, "Back content is required").max(5000))
    .optional(),
});
export type UpdateFlashcardDTO = z.infer<typeof UpdateFlashcardDTO>;

// ==========================================
// Delete Flashcard Response
// ==========================================

export const DeleteFlashcardResponseSchema = z.object({
  success: z.boolean(),
  message: z.string().optional(),
  deletedReviewsCount: z.number().optional(),
});
export type DeleteFlashcardResponse = z.infer<
  typeof DeleteFlashcardResponseSchema
>;

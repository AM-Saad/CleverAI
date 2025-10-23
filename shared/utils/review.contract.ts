import { z } from "zod";

// Review Grade enum values matching domain
export const ReviewGradeSchema = z.enum([
  "0",
  "1",
  "2",
  "3",
  "4",
  "5",
] as const);
export type ReviewGrade = z.infer<typeof ReviewGradeSchema>;

// Card enrollment request
// Enrollment request: prefer explicit resourceType + resourceId.
export const EnrollCardRequestSchema = z
  .union([
    z.object({
      resourceType: z.enum(["material", "flashcard"] as const),
      resourceId: z.string().min(1),
    }),
    // backward-compatible shape
    z.object({ materialId: z.string().min(1) }),
  ])
  .refine(
    (val: unknown) => {
      // Ensure exactly one of the shapes is used
      if (val && typeof val === "object" && "materialId" in val) return true;
      const obj = val as Record<string, unknown>;
      return (
        typeof obj.resourceType === "string" &&
        typeof obj.resourceId === "string"
      );
    },
    {
      message:
        "Provide either materialId (deprecated) or resourceType+resourceId",
    }
  );

export type EnrollCardRequest =
  | { resourceType: "material" | "flashcard"; resourceId: string }
  | { materialId: string };

export const EnrollCardResponseSchema = z.object({
  success: z.boolean(),
  cardId: z.string().optional(),
  message: z.string().optional(),
});
export type EnrollCardResponse = z.infer<typeof EnrollCardResponseSchema>;

// Card grading request
export const GradeCardRequestSchema = z.object({
  cardId: z.string(),
  grade: z.enum(["0", "1", "2", "3", "4", "5"]),
  requestId: z.string().optional(), // For idempotency
});
export type GradeCardRequest = z.infer<typeof GradeCardRequestSchema>;

export const GradeCardResponseSchema = z.object({
  success: z.boolean(),
  nextReviewAt: z.string().optional(), // ISO date string
  intervalDays: z.number().optional(),
  easeFactor: z.number().optional(),
  message: z.string().optional(),
});
export type GradeCardResponse = z.infer<typeof GradeCardResponseSchema>;

// Review queue response
export const ReviewCardSchema = z.object({
  cardId: z.string(),
  resourceType: z.enum(["material", "flashcard"] as const),
  resourceId: z.string(),
  // resource payload: for 'flashcard' we include front/back; for 'material' include a canonical material shape
  resource: z.union([
    z.object({
      // flashcard
      front: z.string(),
      back: z.string(),
      hint: z.string().optional(),
      tags: z.array(z.string()).optional(),
      folderId: z.string(),
    }),
    z.object({
      // material
      title: z.string(),
      content: z.string(),
      tags: z.array(z.string()).optional(),
      folderId: z.string(),
    }),
  ]),
  reviewState: z.object({
    repetitions: z.number(),
    easeFactor: z.number(),
    intervalDays: z.number(),
    nextReviewAt: z.string(), // ISO date string
    lastReviewedAt: z.string().optional(), // ISO date string
  }),
});
export type ReviewCard = z.infer<typeof ReviewCardSchema>;

export const ReviewQueueResponseSchema = z.object({
  cards: z.array(ReviewCardSchema),
  stats: z.object({
    total: z.number(),
    new: z.number(),
    due: z.number(),
    learning: z.number(),
  }),
});
export type ReviewQueueResponse = z.infer<typeof ReviewQueueResponseSchema>;

// Error response schema
export const ReviewErrorResponseSchema = z.object({
  success: z.literal(false),
  error: z.string(),
  code: z.string().optional(),
});
export type ReviewErrorResponse = z.infer<typeof ReviewErrorResponseSchema>;

// Success wrapper for type safety
export const ReviewSuccessResponseSchema = <T extends z.ZodType>(
  dataSchema: T
) =>
  z.object({
    success: z.literal(true),
    data: dataSchema,
  });

// Analytics schemas
export const ReviewStatsSchema = z.object({
  totalCards: z.number(),
  totalReviews: z.number(),
  currentStreak: z.number(),
  longestStreak: z.number(),
  averageGrade: z.number(),
  retentionRate: z.number(),
  dailyReviewCounts: z.array(
    z.object({
      date: z.string(), // ISO date string
      count: z.number(),
    })
  ),
  gradeDistribution: z.object({
    "0": z.number(),
    "1": z.number(),
    "2": z.number(),
    "3": z.number(),
    "4": z.number(),
    "5": z.number(),
  }),
});
export type ReviewStats = z.infer<typeof ReviewStatsSchema>;

export const UpcomingReviewsSchema = z.object({
  today: z.number(),
  tomorrow: z.number(),
  thisWeek: z.number(),
  nextWeek: z.number(),
});
export type UpcomingReviews = z.infer<typeof UpcomingReviewsSchema>;

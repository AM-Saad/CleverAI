import { z } from "zod";

export const LearningHomeSourceSchema = z.enum(["workspace", "language"]);
export type LearningHomeSource = z.infer<typeof LearningHomeSourceSchema>;

export const LearningHomePromptSchema = z.object({
  id: z.string(),
  source: LearningHomeSourceSchema,
  sourceLabel: z.string(),
  sourceDetail: z.string(),
  sourceHref: z.string(),
  question: z.string(),
  supportingText: z.string().optional(),
  answer: z.string(),
  postcardText: z.string(),
  to: z.string(),
  repetitions: z.number().int().nonnegative(),
  intervalDays: z.number().int().nonnegative(),
  nextReviewAt: z.string().datetime(),
  lastReviewedAt: z.string().datetime().optional(),
  firstLearnedAt: z.string().datetime().optional(),
});
export type LearningHomePrompt = z.infer<typeof LearningHomePromptSchema>;

export const LearningHomeWorkspaceStatusSchema = z.object({
  id: z.string(),
  title: z.string(),
  total: z.number().int().nonnegative(),
  new: z.number().int().nonnegative(),
  learning: z.number().int().nonnegative(),
  due: z.number().int().nonnegative(),
  mature: z.number().int().nonnegative(),
  oldestDueAt: z.string().datetime().nullable(),
  lastReviewedAt: z.string().datetime().nullable(),
});
export type LearningHomeWorkspaceStatus = z.infer<
  typeof LearningHomeWorkspaceStatusSchema
>;

export const LearningHomeLanguageStatusSchema = z.object({
  totalWords: z.number().int().nonnegative(),
  enrolled: z.number().int().nonnegative(),
  mastered: z.number().int().nonnegative(),
  due: z.number().int().nonnegative(),
  new: z.number().int().nonnegative(),
  learning: z.number().int().nonnegative(),
  oldestDueAt: z.string().datetime().nullable(),
  lastReviewedAt: z.string().datetime().nullable(),
});
export type LearningHomeLanguageStatus = z.infer<
  typeof LearningHomeLanguageStatusSchema
>;

export const LearningHomeNextActionSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("workspace"),
    workspaceId: z.string(),
    workspaceTitle: z.string(),
    dueCount: z.number().int().positive(),
    oldestDueAt: z.string().datetime(),
    otherDueCount: z.number().int().nonnegative(),
    to: z.string(),
  }),
  z.object({
    kind: z.literal("language"),
    dueCount: z.number().int().positive(),
    oldestDueAt: z.string().datetime(),
    otherDueCount: z.number().int().nonnegative(),
    to: z.literal("/language/review"),
  }),
  z.object({
    kind: z.literal("done"),
    to: z.string(),
  }),
  z.object({
    kind: z.literal("empty"),
    to: z.literal("/workspaces"),
  }),
]);
export type LearningHomeNextAction = z.infer<
  typeof LearningHomeNextActionSchema
>;

export const LearningHomeTomorrowSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  total: z.number().int().nonnegative(),
  workspace: z.number().int().nonnegative(),
  language: z.number().int().nonnegative(),
});
export type LearningHomeTomorrow = z.infer<typeof LearningHomeTomorrowSchema>;

export const LearningHomeSnapshotSchema = z.object({
  generatedAt: z.string().datetime(),
  nextAction: LearningHomeNextActionSchema,
  workspaceStatuses: z.array(LearningHomeWorkspaceStatusSchema),
  languageStatus: LearningHomeLanguageStatusSchema,
  tomorrow: LearningHomeTomorrowSchema,
  spark: LearningHomePromptSchema.nullable(),
  postcard: LearningHomePromptSchema.nullable(),
});
export type LearningHomeSnapshot = z.infer<typeof LearningHomeSnapshotSchema>;

export const LearningHomeQuerySchema = z.object({
  timezoneOffsetMinutes: z.coerce.number().int().min(-840).max(840).default(0),
});
export type LearningHomeQuery = z.infer<typeof LearningHomeQuerySchema>;

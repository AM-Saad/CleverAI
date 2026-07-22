import { z } from "zod";
import { isDateKey, WEEKDAYS } from "./daily-recurrence";

export const DateKeySchema = z
  .string()
  .refine(isDateKey, "Invalid calendar date");
export const LocalTimeSchema = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use HH:mm");
export const TimingModeSchema = z.enum(["ALL_DAY", "TIMED"]);
export const ActionLifecycleSchema = z.enum(["ACTIVE", "ARCHIVED"]);
export const OccurrenceStatusSchema = z.enum([
  "OPEN",
  "COMPLETED",
  "SKIPPED",
  "CANCELLED",
]);
export const PlacementStateSchema = z.enum(["ACTIVE", "MOVED", "COMPLETED"]);

export const RecurrenceRuleSchema = z
  .object({
    frequency: z.enum(["DAILY", "WEEKLY", "MONTHLY", "YEARLY"]),
    interval: z.number().int().min(1).max(999).default(1),
    weekdays: z.array(z.enum(WEEKDAYS)).max(7).optional(),
    monthDay: z.number().int().min(1).max(31).optional(),
    month: z.number().int().min(1).max(12).optional(),
    missingDayPolicy: z.literal("LAST_DAY").default("LAST_DAY"),
    ends: z.enum(["NEVER", "ON_DATE", "AFTER_COUNT"]).default("NEVER"),
    untilDate: DateKeySchema.optional(),
    count: z.number().int().min(1).max(100_000).optional(),
  })
  .superRefine((rule, context) => {
    if (rule.ends === "ON_DATE" && !rule.untilDate) {
      context.addIssue({
        code: "custom",
        path: ["untilDate"],
        message: "End date is required",
      });
    }
    if (rule.ends === "AFTER_COUNT" && !rule.count) {
      context.addIssue({
        code: "custom",
        path: ["count"],
        message: "Occurrence count is required",
      });
    }
    if (rule.frequency === "WEEKLY" && rule.weekdays && !rule.weekdays.length) {
      context.addIssue({
        code: "custom",
        path: ["weekdays"],
        message: "Choose at least one weekday",
      });
    }
  });

export const DailyNoteSchema = z.object({
  id: z.string().min(1),
  userId: z.string().min(1),
  dateKey: DateKeySchema,
  content: z.unknown(),
  contentFormat: z.literal("TIPTAP_JSON").default("TIPTAP_JSON"),
  version: z.number().int().positive(),
  createdAt: z.string().or(z.date()),
  updatedAt: z.string().or(z.date()),
});

export const ActionItemSchema = z
  .object({
    id: z.string().min(1),
    userId: z.string().min(1),
    title: z.string(),
    description: z.string().nullable().optional(),
    timingMode: TimingModeSchema,
    startDate: DateKeySchema,
    localTime: LocalTimeSchema.nullable().optional(),
    timezone: z.string().nullable().optional(),
    recurrence: RecurrenceRuleSchema.nullable().optional(),
    lifecycle: ActionLifecycleSchema,
    createdAt: z.string().or(z.date()),
    updatedAt: z.string().or(z.date()),
  })
  .superRefine((item, context) => {
    if (item.timingMode === "TIMED" && !item.localTime) {
      context.addIssue({
        code: "custom",
        path: ["localTime"],
        message: "Timed items require a time",
      });
    }
  });

export const ActionOccurrenceSchema = z.object({
  id: z.string().min(1),
  occurrenceKey: z.string().min(1),
  userId: z.string().min(1),
  actionItemId: z.string().min(1),
  originalDateKey: DateKeySchema,
  currentPlacementId: z.string().nullable().optional(),
  status: OccurrenceStatusSchema,
  completedAt: z.string().or(z.date()).nullable().optional(),
  version: z.number().int().positive(),
  createdAt: z.string().or(z.date()),
  updatedAt: z.string().or(z.date()),
});

export const ActionPlacementSchema = z.object({
  id: z.string().min(1),
  userId: z.string().min(1),
  occurrenceId: z.string().min(1),
  occurrenceKey: z.string().min(1),
  dateKey: DateKeySchema,
  timingMode: TimingModeSchema,
  localTime: LocalTimeSchema.nullable().optional(),
  timezone: z.string().nullable().optional(),
  position: z.string().min(1),
  state: PlacementStateSchema,
  movedToPlacementId: z.string().nullable().optional(),
  createdAt: z.string().or(z.date()),
  updatedAt: z.string().or(z.date()),
});

export const CreateActionItemDTO = z
  .object({
    id: z.string().min(1),
    occurrenceId: z.string().min(1),
    placementId: z.string().min(1),
    title: z.string().trim().min(1).max(500),
    description: z.string().max(20_000).nullable().optional(),
    timingMode: TimingModeSchema,
    startDate: DateKeySchema,
    localTime: LocalTimeSchema.nullable().optional(),
    timezone: z.string().nullable().optional(),
    recurrence: RecurrenceRuleSchema.nullable().optional(),
    position: z.string().min(1),
  })
  .superRefine((item, context) => {
    if (item.timingMode === "TIMED" && !item.localTime) {
      context.addIssue({
        code: "custom",
        path: ["localTime"],
        message: "Timed items require a time",
      });
    }
  });

export const UpdateActionItemDTO = z.object({
  title: z.string().trim().min(1).max(500).optional(),
  description: z.string().max(20_000).nullable().optional(),
});

export const RescheduleOccurrenceDTO = z.object({
  actionItemId: z.string().min(1),
  occurrenceId: z.string().min(1),
  occurrenceKey: z.string().min(1),
  originalDateKey: DateKeySchema,
  sourcePlacementId: z.string().min(1),
  sourceTimingMode: TimingModeSchema,
  sourceLocalTime: LocalTimeSchema.nullable().optional(),
  sourceTimezone: z.string().nullable().optional(),
  sourcePosition: z.string().min(1),
  targetPlacementId: z.string().min(1),
  targetDateKey: DateKeySchema,
  targetTimingMode: TimingModeSchema,
  targetLocalTime: LocalTimeSchema.nullable().optional(),
  targetTimezone: z.string().nullable().optional(),
  targetPosition: z.string().min(1),
});

export const MaterializeOccurrenceDTO = z
  .object({
    actionItemId: z.string().min(1),
    occurrenceId: z.string().min(1),
    occurrenceKey: z.string().min(1),
    originalDateKey: DateKeySchema,
    sourcePlacementId: z.string().min(1),
    sourceTimingMode: TimingModeSchema,
    sourceLocalTime: LocalTimeSchema.nullable().optional(),
    sourceTimezone: z.string().nullable().optional(),
    sourcePosition: z.string().min(1),
  })
  .superRefine((item, context) => {
    if (item.sourceTimingMode === "TIMED" && !item.sourceLocalTime) {
      context.addIssue({
        code: "custom",
        path: ["sourceLocalTime"],
        message: "Timed items require a time",
      });
    }
  });

export const CompleteOccurrenceDTO = MaterializeOccurrenceDTO.safeExtend({
  completedAt: z.string().datetime(),
});

export const DailyNoteUpsertDTO = z.object({
  id: z.string().min(1),
  dateKey: DateKeySchema,
  content: z.unknown(),
  baseVersion: z.number().int().nonnegative().default(0),
});

export const OccurrenceCommandDTO = z.object({
  occurrenceKey: z.string().min(1),
});

export const DayItemSchema = z.object({
  occurrenceKey: z.string(),
  originalDateKey: DateKeySchema,
  actionItem: ActionItemSchema,
  occurrence: ActionOccurrenceSchema.nullable(),
  activePlacement: ActionPlacementSchema.nullable(),
  historyPlacement: ActionPlacementSchema.nullable(),
  virtual: z.boolean(),
});

export const DayProjectionSchema = z.object({
  dateKey: DateKeySchema,
  note: DailyNoteSchema.nullable(),
  items: z.array(DayItemSchema),
});

export const DailyBootstrapSchema = z.object({
  actionItems: z.array(ActionItemSchema),
  occurrences: z.array(
    z.object({
      occurrence: ActionOccurrenceSchema,
      placements: z.array(ActionPlacementSchema),
    }),
  ),
});

export type RecurrenceRuleDTO = z.infer<typeof RecurrenceRuleSchema>;
export type DailyNoteDTO = z.infer<typeof DailyNoteSchema>;
export type ActionItemDTO = z.infer<typeof ActionItemSchema>;
export type ActionOccurrenceDTO = z.infer<typeof ActionOccurrenceSchema>;
export type ActionPlacementDTO = z.infer<typeof ActionPlacementSchema>;
export type CreateActionItemDTO = z.infer<typeof CreateActionItemDTO>;
export type RescheduleOccurrenceDTO = z.infer<typeof RescheduleOccurrenceDTO>;
export type DayItemDTO = z.infer<typeof DayItemSchema>;
export type DayProjectionDTO = z.infer<typeof DayProjectionSchema>;
export type DailyBootstrapDTO = z.infer<typeof DailyBootstrapSchema>;

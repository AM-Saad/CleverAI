import { RecurrenceRuleSchema } from "../../../../shared/utils/daily.contract";
import {
  occurrenceKey,
  recurrenceMatchesDate,
} from "../../../../shared/utils/daily-recurrence";

export async function ownedActionItem(
  tx: any,
  userId: string,
  actionItemId: string,
) {
  const item = await tx.actionItem.findFirst({
    where: { id: actionItemId, userId },
  });
  if (!item)
    throw Object.assign(new Error("Action item not found"), {
      statusCode: 404,
    });
  return item;
}

/**
 * A recurring occurrence is virtual until first touched. Returns the existing
 * durable row if one was already materialized; otherwise validates the
 * request against the owning series' recurrence rule and creates the
 * occurrence with its first placement in one write.
 */
export async function ensureOccurrence(
  tx: any,
  userId: string,
  input: {
    actionItemId: string;
    occurrenceId: string;
    occurrenceKey: string;
    originalDateKey: string;
    sourcePlacementId: string;
    sourceTimingMode: "ALL_DAY" | "TIMED";
    sourceLocalTime?: string | null;
    sourceTimezone?: string | null;
    sourcePosition: string;
  },
) {
  const existing = await tx.actionOccurrence.findUnique({
    where: {
      userId_occurrenceKey: { userId, occurrenceKey: input.occurrenceKey },
    },
    include: { placements: true },
  });
  if (existing) return existing;

  const item = await ownedActionItem(tx, userId, input.actionItemId);
  const expectedKey = occurrenceKey(item.id, input.originalDateKey);
  const parsedRule = item.recurrence
    ? RecurrenceRuleSchema.safeParse(item.recurrence)
    : null;
  if (
    input.occurrenceKey !== expectedKey ||
    (parsedRule && !parsedRule.success)
  ) {
    throw Object.assign(new Error("Invalid recurring occurrence"), {
      statusCode: 400,
    });
  }
  if (
    !recurrenceMatchesDate(
      item.startDate,
      parsedRule?.data,
      input.originalDateKey,
    )
  ) {
    throw Object.assign(new Error("The series does not occur on this date"), {
      statusCode: 400,
    });
  }

  return tx.actionOccurrence.create({
    data: {
      id: input.occurrenceId,
      occurrenceKey: input.occurrenceKey,
      userId,
      actionItemId: item.id,
      originalDateKey: input.originalDateKey,
      currentPlacementId: input.sourcePlacementId,
      placements: {
        create: {
          id: input.sourcePlacementId,
          userId,
          occurrenceKey: input.occurrenceKey,
          dateKey: input.originalDateKey,
          timingMode: input.sourceTimingMode,
          localTime: input.sourceLocalTime ?? null,
          timezone: input.sourceTimezone ?? null,
          position: input.sourcePosition,
          state: "ACTIVE",
        },
      },
    },
    include: { placements: true },
  });
}

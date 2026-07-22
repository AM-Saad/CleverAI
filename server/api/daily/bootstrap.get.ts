import {
  ActionItemSchema,
  ActionOccurrenceSchema,
  ActionPlacementSchema,
  DailyBootstrapSchema,
} from "@shared/utils/daily.contract";
import type {
  ActionItem,
  ActionOccurrence,
  ActionPlacement,
} from "@prisma/client";
import { requireRole } from "~~/server/utils/auth";
import { success } from "@server/utils/error";

export default defineEventHandler(async (event) => {
  const user = await requireRole(event, ["USER"]);
  const [actionItems, occurrences] = await Promise.all([
    event.context.prisma.actionItem.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "asc" },
    }),
    event.context.prisma.actionOccurrence.findMany({
      where: { userId: user.id },
      include: { placements: { orderBy: { createdAt: "asc" } } },
      orderBy: { updatedAt: "asc" },
    }),
  ]);
  return success(
    DailyBootstrapSchema.parse({
      actionItems: actionItems.map((item: ActionItem) =>
        ActionItemSchema.parse(item),
      ),
      occurrences: occurrences.map(
        (row: ActionOccurrence & { placements: ActionPlacement[] }) => {
          const { placements, ...occurrence } = row;
          return {
            occurrence: ActionOccurrenceSchema.parse(occurrence),
            placements: placements.map((placement: ActionPlacement) =>
              ActionPlacementSchema.parse(placement),
            ),
          };
        },
      ),
    }),
  );
});

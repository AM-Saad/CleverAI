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
import { offlineVersions } from "@server/modules/daily/application/actionItemOfflineVersions";
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
  const [actionItemVersions, occurrenceVersions] = await Promise.all([
    offlineVersions(
      event.context.prisma,
      user.id,
      "actionItem",
      actionItems.map((item: ActionItem) => item.id),
    ),
    offlineVersions(
      event.context.prisma,
      user.id,
      "actionOccurrence",
      occurrences.map((item: ActionOccurrence) => item.id),
    ),
  ]);
  return success(
    DailyBootstrapSchema.parse({
      actionItems: actionItems.map((item: ActionItem) =>
        ActionItemSchema.parse({
          ...item,
          version: actionItemVersions.get(item.id) ?? 0,
        }),
      ),
      occurrences: occurrences.map(
        (row: ActionOccurrence & { placements: ActionPlacement[] }) => {
          const { placements, ...occurrence } = row;
          return {
            occurrence: ActionOccurrenceSchema.parse({
              ...occurrence,
              version: occurrenceVersions.get(occurrence.id) ?? 0,
            }),
            placements: placements.map((placement: ActionPlacement) =>
              ActionPlacementSchema.parse(placement),
            ),
          };
        },
      ),
    }),
  );
});

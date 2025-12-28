import { requireRole } from "~~/server/utils/auth";
import { getUserProgress } from "~~/server/utils/level";
import { success } from "@server/utils/error";

export default defineEventHandler(async (event) => {
  const user = await requireRole(event, ["USER"]);
  const prisma = event.context.prisma;

  // Aggregate total XP from append-only events
  const totalXP = await prisma.xpEvent.aggregate({
    where: { userId: user.id },
    _sum: { xp: true },
  });

  const xp = totalXP._sum.xp ?? 0;

  // Derive progress (pure calculation)
  const progress = getUserProgress(xp);

  return success(progress);
});

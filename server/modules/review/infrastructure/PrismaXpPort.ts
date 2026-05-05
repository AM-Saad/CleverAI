import { endOfDay, startOfDay } from "date-fns";
import { calculateEnrollXP, calculateReviewXP } from "@server/utils/xp";
import type {
  AwardEnrollXpInput,
  AwardReviewXpInput,
  XpPort,
} from "../ports/XpPort";
import { prisma as defaultPrisma } from "@server/utils/prisma";

export class PrismaXpPort implements XpPort {
  async awardReviewXp(input: AwardReviewXpInput): Promise<number> {
    const dayStart = startOfDay(input.now);
    const dayEnd = endOfDay(input.now);

    const aggregate = await input.tx.xpEvent.aggregate({
      where: {
        userId: input.userId,
        createdAt: { gte: dayStart, lte: dayEnd },
      },
      _sum: { xp: true },
    });
    const currentDailyXP = aggregate._sum.xp || 0;

    const existingXp = await input.tx.xpEvent.findFirst({
      where: {
        userId: input.userId,
        cardId: input.resourceId,
        source: input.source,
        createdAt: { gte: dayStart, lte: dayEnd },
      },
    });

    if (existingXp) return 0;

    const { effectiveXP } = calculateReviewXP({
      easeFactor: input.easeFactor,
      intervalDays: input.intervalDays,
      grade: input.grade,
      now: input.now,
      nextReviewAt: input.nextReviewAt,
      dailyXP: currentDailyXP,
    });

    await input.tx.xpEvent.create({
      data: {
        userId: input.userId,
        cardId: input.resourceId,
        source: input.source,
        xp: effectiveXP,
        createdAt: input.now,
      },
    });

    return effectiveXP;
  }

  async awardEnrollXp(input: AwardEnrollXpInput): Promise<number> {
    const db = input.tx ?? defaultPrisma;
    const now = input.now ?? new Date();

    const existingXp = await db.xpEvent.findFirst({
      where: {
        userId: input.userId,
        cardId: input.resourceId,
        source: input.source,
      },
    });

    if (existingXp) return 0;

    const dayStart = startOfDay(now);
    const dayEnd = endOfDay(now);
    const aggregate = await db.xpEvent.aggregate({
      where: {
        userId: input.userId,
        createdAt: { gte: dayStart, lte: dayEnd },
      },
      _sum: { xp: true },
    });

    const xp = calculateEnrollXP(aggregate._sum.xp || 0);

    await db.xpEvent.create({
      data: {
        userId: input.userId,
        cardId: input.resourceId,
        source: input.source,
        xp,
        createdAt: now,
      },
    });

    return xp;
  }
}

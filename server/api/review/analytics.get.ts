import type { CardReview } from "@prisma/client";
import { z } from "zod";
import { requireRole } from "~~/server/utils/auth";
import { Errors, success } from "@server/utils/error";

const AnalyticsQuerySchema = z.object({
  workspaceId: z.string().optional(),
  days: z.coerce.number().min(1).max(365).default(30),
});

const ReviewAnalyticsSchema = z.object({
  totalCards: z.number(),
  totalReviews: z.number(),
  currentStreak: z.number(),
  longestStreak: z.number(),
  averageGrade: z.number(),
  retentionRate: z.number(),
  dailyReviewCounts: z.array(z.object({
    date: z.string(),
    count: z.number(),
  })),
  performanceMetrics: z.object({
    averageEaseFactor: z.number(),
    averageInterval: z.number(),
    newCards: z.number(),
    learningCards: z.number(),
    dueCards: z.number(),
    masteredCards: z.number(),
  }),
  gradeDistribution: z.object({
    "0": z.number(),
    "1": z.number(),
    "2": z.number(),
    "3": z.number(),
    "4": z.number(),
    "5": z.number(),
  }),
  streakData: z.object({
    currentStreak: z.number(),
    longestStreak: z.number(),
    totalReviewDays: z.number(),
  }),
});

export default defineEventHandler(async (event) => {
  const user = await requireRole(event, ["USER"]);
  // Validate query explicitly to align with unified error strategy
  let query;
  try {
    query = AnalyticsQuerySchema.parse(getQuery(event));
  } catch (e) {
    if (e instanceof z.ZodError) {
      throw Errors.badRequest(
        "Invalid analytics query",
        e.issues.map((issue) => ({ path: issue.path, message: issue.message }))
      );
    }
    throw Errors.badRequest("Invalid analytics query");
  }
  const prisma = event.context.prisma;

  const { workspaceId, days } = query;
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const rangeStart = new Date(today);
  rangeStart.setUTCDate(today.getUTCDate() - days + 1);

  let cardReviews: CardReview[];
  let reviewEvents: Array<{ cardId: string | null; createdAt: Date }>;
  try {
    [cardReviews, reviewEvents] = await Promise.all([
      prisma.cardReview.findMany({
        where: { userId: user.id, ...(workspaceId ? { workspaceId } : {}) },
      }),
      prisma.xpEvent.findMany({
        where: {
          userId: user.id,
          source: "review",
          createdAt: { gte: rangeStart },
        },
        select: {
          cardId: true,
          createdAt: true,
        },
      }),
    ]);
  } catch {
    throw Errors.server("Failed to fetch review analytics");
  }

  const scopedCardIds = new Set(cardReviews.map((cardReview) => cardReview.cardId));
  const scopedReviewEvents = workspaceId
    ? reviewEvents.filter((event) => event.cardId && scopedCardIds.has(event.cardId))
    : reviewEvents;

  const dailyCounts = new Map<string, number>();
  for (let offset = 0; offset < days; offset++) {
    const date = new Date(rangeStart);
    date.setUTCDate(rangeStart.getUTCDate() + offset);
    dailyCounts.set(date.toISOString().slice(0, 10), 0);
  }
  for (const event of scopedReviewEvents) {
    const key = event.createdAt.toISOString().slice(0, 10);
    if (!dailyCounts.has(key)) continue;
    dailyCounts.set(key, (dailyCounts.get(key) ?? 0) + 1);
  }
  const dailyReviewCounts = Array.from(dailyCounts.entries()).map(([date, count]) => ({
    date,
    count,
  }));
  const reviewDays = dailyReviewCounts.filter((entry) => entry.count > 0).map((entry) => entry.date);
  const reviewDaySet = new Set(reviewDays);
  let currentStreak = 0;
  for (let cursor = new Date(today); ; cursor.setUTCDate(cursor.getUTCDate() - 1)) {
    const key = cursor.toISOString().slice(0, 10);
    if (!reviewDaySet.has(key)) break;
    currentStreak++;
  }
  let longestStreak = 0;
  let runningStreak = 0;
  for (const entry of dailyReviewCounts) {
    if (entry.count > 0) {
      runningStreak++;
      longestStreak = Math.max(longestStreak, runningStreak);
    } else {
      runningStreak = 0;
    }
  }

  const totalCards = cardReviews.length;
  const totalReviews = scopedReviewEvents.length;
  const validGrades = cardReviews.filter(
    (cardReview) => cardReview.lastGrade !== null && cardReview.lastGrade !== undefined
  );
  const grades = validGrades.map((cardReview) => cardReview.lastGrade!);
  const averageGrade =
    grades.length > 0
      ? grades.reduce((sum: number, grade: number) => sum + grade, 0) /
      grades.length
      : 0;
  const successfulReviews = grades.filter((g: number) => g >= 3).length;
  const retentionRate =
    grades.length > 0 ? successfulReviews / grades.length : 0;
  const gradeDistribution = {
    "0": grades.filter((g: number) => g === 0).length,
    "1": grades.filter((g: number) => g === 1).length,
    "2": grades.filter((g: number) => g === 2).length,
    "3": grades.filter((g: number) => g === 3).length,
    "4": grades.filter((g: number) => g === 4).length,
    "5": grades.filter((g: number) => g === 5).length,
  };
  const totalReviewDays = reviewDays.length;
  const averageEaseFactor =
    cardReviews.length > 0
      ? cardReviews.reduce((sum, cardReview) => sum + cardReview.easeFactor, 0) /
      cardReviews.length
      : 2.5;
  const averageInterval =
    cardReviews.length > 0
      ? cardReviews.reduce((sum, cardReview) => sum + cardReview.intervalDays, 0) /
      cardReviews.length
      : 1;
  const newCards = cardReviews.filter((cardReview) => cardReview.repetitions === 0).length;
  const learningCards = cardReviews.filter(
    (cardReview) => cardReview.repetitions > 0 && cardReview.repetitions < 3
  ).length;
  const dueCards = cardReviews.filter(
    (cardReview) => cardReview.nextReviewAt <= new Date()
  ).length;
  const masteredCards = cardReviews.filter(
    (cardReview) => cardReview.repetitions >= 3 && cardReview.easeFactor > 2.5
  ).length;

  const analytics = ReviewAnalyticsSchema.parse({
    totalCards,
    totalReviews,
    currentStreak,
    longestStreak,
    averageGrade: Math.round(averageGrade * 100) / 100,
    retentionRate: Math.round(retentionRate * 100) / 100,
    dailyReviewCounts,
    performanceMetrics: {
      averageEaseFactor: Math.round(averageEaseFactor * 100) / 100,
      averageInterval: Math.round(averageInterval * 100) / 100,
      newCards,
      learningCards,
      dueCards,
      masteredCards,
    },
    gradeDistribution,
    streakData: { currentStreak, longestStreak, totalReviewDays },
  });

  return success(analytics);
});

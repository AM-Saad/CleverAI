import { z } from "zod";
import { requireRole } from "~~/server/utils/auth";
import { Errors, success } from "@server/utils/error";

const AnalyticsQuerySchema = z.object({
  folderId: z.string().optional(),
  days: z.coerce.number().min(1).max(365).default(30),
});

const ReviewAnalyticsSchema = z.object({
  totalCards: z.number(),
  totalReviews: z.number(),
  currentStreak: z.number(),
  longestStreak: z.number(),
  averageGrade: z.number(),
  retentionRate: z.number(),
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

  const { folderId } = query;

  let cardReviews;
  try {
    cardReviews = await prisma.cardReview.findMany({
      where: { userId: user.id, ...(folderId ? { folderId } : {}) },
    });
  } catch {
    throw Errors.server("Failed to fetch review analytics");
  }

  const totalCards = cardReviews.length;
  const totalReviews = cardReviews.filter((cr) => cr.repetitions > 0).length;
  const validGrades = cardReviews.filter(
    (cr) => cr.lastGrade !== null && cr.lastGrade !== undefined
  );
  const grades = validGrades.map((cr) => cr.lastGrade!);
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
  const allStreaks = cardReviews.map((cr) => cr.streak);
  const currentStreak = Math.max(...allStreaks, 0);
  const longestStreak = currentStreak;
  const totalReviewDays = cardReviews.filter((cr) => cr.lastReviewedAt).length;
  const averageEaseFactor =
    cardReviews.length > 0
      ? cardReviews.reduce((sum, cr) => sum + cr.easeFactor, 0) /
        cardReviews.length
      : 2.5;
  const averageInterval =
    cardReviews.length > 0
      ? cardReviews.reduce((sum, cr) => sum + cr.intervalDays, 0) /
        cardReviews.length
      : 1;
  const newCards = cardReviews.filter((cr) => cr.repetitions === 0).length;
  const learningCards = cardReviews.filter(
    (cr) => cr.repetitions > 0 && cr.repetitions < 3
  ).length;
  const dueCards = cardReviews.filter(
    (cr) => cr.nextReviewAt <= new Date()
  ).length;
  const masteredCards = cardReviews.filter(
    (cr) => cr.repetitions >= 3 && cr.easeFactor > 2.5
  ).length;

  const analytics = ReviewAnalyticsSchema.parse({
    totalCards,
    totalReviews,
    currentStreak,
    longestStreak,
    averageGrade: Math.round(averageGrade * 100) / 100,
    retentionRate: Math.round(retentionRate * 100) / 100,
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

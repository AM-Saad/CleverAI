import { z } from "zod";
import { requireRole } from "~~/server/middleware/_auth";
import { Errors, success } from "@server/utils/error";

const DebugUpdateSchema = z.object({
  cardId: z.string().min(1),
  easeFactor: z.number().min(1.3).max(5.0).optional(),
  intervalDays: z.number().min(0).max(365).optional(),
  repetitions: z.number().min(0).max(50).optional(),
  streak: z.number().min(0).max(1000).optional(),
  nextReviewAt: z.string().optional(), // ISO date string
  lastReviewedAt: z.string().optional(), // ISO date string
  lastGrade: z.number().min(0).max(5).optional(),
});

export default defineEventHandler(async (event) => {
  // Only allow in development
  if (process.env.NODE_ENV !== "development") {
    throw Errors.notFound("endpoint");
  }

  try {
    const body = await readBody(event);
    let validatedBody;
    try {
      validatedBody = DebugUpdateSchema.parse(body);
    } catch (e) {
      if (e instanceof z.ZodError) {
        throw Errors.badRequest(
          "Invalid debug parameters",
          e.issues.map((issue) => ({
            path: issue.path,
            message: issue.message,
          }))
        );
      }
      throw Errors.badRequest("Invalid debug parameters");
    }

    const user = await requireRole(event, ["USER"]);
    const prisma = event.context.prisma;

    // Find the card review entry
    const cardReview = await prisma.cardReview.findFirst({
      where: {
        id: validatedBody.cardId,
        userId: user.id,
      },
    });

    if (!cardReview) {
      throw Errors.notFound("card");
    }

    // Prepare update data
    const updateData: {
      easeFactor?: number;
      intervalDays?: number;
      repetitions?: number;
      streak?: number;
      nextReviewAt?: Date;
      lastReviewedAt?: Date;
      lastGrade?: number;
    } = {};

    if (validatedBody.easeFactor !== undefined) {
      updateData.easeFactor = validatedBody.easeFactor;
    }

    if (validatedBody.intervalDays !== undefined) {
      updateData.intervalDays = validatedBody.intervalDays;
    }

    if (validatedBody.repetitions !== undefined) {
      updateData.repetitions = validatedBody.repetitions;
    }

    if (validatedBody.streak !== undefined) {
      updateData.streak = validatedBody.streak;
    }

    if (validatedBody.nextReviewAt) {
      updateData.nextReviewAt = new Date(validatedBody.nextReviewAt);
    }

    if (validatedBody.lastReviewedAt) {
      updateData.lastReviewedAt = new Date(validatedBody.lastReviewedAt);
    }

    if (validatedBody.lastGrade !== undefined) {
      updateData.lastGrade = validatedBody.lastGrade;
    }

    // Update the card
    let updatedCard;
    try {
      updatedCard = await prisma.cardReview.update({
        where: { id: validatedBody.cardId },
        data: updateData,
      });
    } catch {
      throw Errors.server("Failed to update card debug values");
    }

    return success({
      message: "Card debug values updated successfully",
      updatedValues: {
        easeFactor: updatedCard.easeFactor,
        intervalDays: updatedCard.intervalDays,
        repetitions: updatedCard.repetitions,
        streak: updatedCard.streak,
        nextReviewAt: updatedCard.nextReviewAt.toISOString(),
        lastReviewedAt: updatedCard.lastReviewedAt?.toISOString(),
        lastGrade: updatedCard.lastGrade,
      },
    });
  } catch (error: unknown) {
    console.error("Debug update error:", error);

    if (error instanceof z.ZodError) {
      throw Errors.badRequest(
        "Invalid debug parameters",
        error.issues.map((issue) => ({
          path: issue.path,
          message: issue.message,
        }))
      );
    }
    if (error && typeof error === "object" && "statusCode" in error)
      throw error;
    throw Errors.server("Failed to update card debug values");
  }
});

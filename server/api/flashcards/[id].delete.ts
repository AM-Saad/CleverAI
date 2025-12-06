// server/api/flashcards/[id].delete.ts
/**
 * Delete a flashcard and its associated CardReview records
 * DELETE /api/flashcards/:id
 *
 * This performs a hard delete with cascade:
 * 1. Deletes all CardReview records referencing this flashcard
 * 2. Deletes the flashcard itself
 */

import { requireRole } from "~~/server/middleware/auth";

export default defineEventHandler(async (event) => {
  const user = await requireRole(event, ["USER"]);
  const prisma = event.context.prisma;

  const id = getRouterParam(event, "id");
  if (!id) {
    throw Errors.badRequest("Flashcard ID is required");
  }

  // Verify flashcard exists and belongs to user's folder
  const existingFlashcard = await prisma.flashcard.findFirst({
    where: { id },
    include: { folder: { select: { userId: true } } },
  });

  if (!existingFlashcard) {
    throw Errors.notFound("Flashcard");
  }

  if (existingFlashcard.folder.userId !== user.id) {
    throw Errors.forbidden(
      "You don't have permission to delete this flashcard"
    );
  }

  // Use transaction to ensure atomicity
  const result = await prisma.$transaction(async (tx) => {
    // 1. Delete associated CardReview records
    const deletedReviews = await tx.cardReview.deleteMany({
      where: {
        cardId: id,
        resourceType: "flashcard",
      },
    });

    // 2. Delete any GradeRequest records (idempotency logs)
    await tx.gradeRequest.deleteMany({
      where: { cardId: id },
    });

    // 3. Delete the flashcard
    await tx.flashcard.delete({
      where: { id },
    });

    return {
      deletedReviewsCount: deletedReviews.count,
    };
  });

  return success({
    success: true,
    message: "Flashcard deleted successfully",
    deletedReviewsCount: result.deletedReviewsCount,
  });
});

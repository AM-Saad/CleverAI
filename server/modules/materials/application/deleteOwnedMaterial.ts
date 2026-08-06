export interface DeleteOwnedMaterialInput {
  prisma: any;
  userId: string;
  materialId: string;
}

export interface DeleteOwnedMaterialResult {
  materialId: string;
  deletedReviewsCount: number;
}

/**
 * Deletes an owned material plus polymorphic review rows that Prisma cannot
 * cascade because CardReview.cardId has no database relation.
 *
 * The caller owns the transaction boundary. HTTP deletion wraps this helper in
 * a transaction; offline sync already invokes it inside its mutation
 * transaction.
 */
export async function deleteOwnedMaterial(
  input: DeleteOwnedMaterialInput,
): Promise<DeleteOwnedMaterialResult | null> {
  const { prisma, userId, materialId } = input;
  const material = await prisma.material.findFirst({
    where: { id: materialId, workspace: { userId } },
    select: { id: true },
  });
  if (!material) return null;

  const [flashcards, questions] = await Promise.all([
    prisma.flashcard.findMany({
      where: { materialId },
      select: { id: true },
    }),
    prisma.question.findMany({
      where: { materialId },
      select: { id: true },
    }),
  ]);

  const reviewTargets: Record<string, unknown>[] = [
    { cardId: materialId, resourceType: "material" },
    { materialId },
  ];
  if (flashcards.length > 0) {
    reviewTargets.push({
      cardId: { in: flashcards.map((item: { id: string }) => item.id) },
      resourceType: "flashcard",
    });
  }
  if (questions.length > 0) {
    reviewTargets.push({
      cardId: { in: questions.map((item: { id: string }) => item.id) },
      resourceType: "question",
    });
  }

  const deletedReviews = await prisma.cardReview.deleteMany({
    where: { OR: reviewTargets },
  });
  await prisma.material.delete({ where: { id: materialId } });

  return {
    materialId,
    deletedReviewsCount: deletedReviews.count,
  };
}

import { extractSourceRef } from "../../../utils/contextBridge";
import type {
  FlashcardDTO,
  QuizQuestionDTO,
} from "../../../../shared/utils/llm-generate.contract";

export interface SaveGeneratedArtifactsInput {
  prisma: any;
  /** Owner — generated cards are auto-enrolled into this user's review queue. */
  userId: string;
  task: "flashcards" | "quiz";
  workspaceId: string;
  materialId?: string;
  replace?: boolean;
  loadedMaterialType?: string | null;
  result: FlashcardDTO[] | QuizQuestionDTO[];
}

export interface SaveGeneratedArtifactsResult {
  savedCount: number;
  deletedCount?: number;
  deletedReviewsCount?: number;
}

export async function saveGeneratedArtifacts(
  input: SaveGeneratedArtifactsInput
): Promise<SaveGeneratedArtifactsResult> {
  const {
    prisma,
    userId,
    task,
    workspaceId,
    materialId,
    replace,
    loadedMaterialType,
    result,
  } = input;

  // Auto-enroll helper: create CardReview rows so freshly generated cards are
  // immediately reviewable (the review queue reads CardReview, not the
  // Flashcard/Question status flag). Same SR defaults as the manual enroll path.
  const enrollCards = async (
    tx: any,
    cardIds: string[],
    resourceType: "flashcard" | "question",
  ) => {
    if (cardIds.length === 0) return;
    await tx.cardReview.createMany({
      data: cardIds.map((cardId) => ({
        userId,
        workspaceId,
        cardId,
        resourceType,
        nextReviewAt: new Date(),
      })),
    });
  };

  let savedCount = 0;
  let deletedCount: number | undefined;
  let deletedReviewsCount: number | undefined;

  await prisma.$transaction(async (tx: any) => {
    if (task === "flashcards") {
      if (replace && materialId) {
        const oldFlashcards = await tx.flashcard.findMany({
          where: { materialId },
          select: { id: true },
        });
        const oldFlashcardIds = oldFlashcards.map((flashcard: { id: string }) =>
          flashcard.id
        );

        if (oldFlashcardIds.length > 0) {
          const reviewsDeleted = await tx.cardReview.deleteMany({
            where: {
              cardId: { in: oldFlashcardIds },
              resourceType: "flashcard",
            },
          });
          deletedReviewsCount = reviewsDeleted.count;
        }

        const deleted = await tx.flashcard.deleteMany({
          where: { materialId },
        });
        deletedCount = deleted.count;
      }

      if (result.length === 0) {
        savedCount = 0;
        return;
      }

      // Create individually so we capture ids (MongoDB createMany returns none),
      // then auto-enroll the new cards into the review queue.
      const createdIds: string[] = [];
      for (const flashcard of result as FlashcardDTO[]) {
        const created = await tx.flashcard.create({
          data: {
            workspaceId,
            materialId: materialId || null,
            front: flashcard.front,
            back: flashcard.back,
            sourceRef:
              materialId && flashcard.sourceMetadata
                ? (extractSourceRef(
                    flashcard.sourceMetadata,
                    loadedMaterialType === "pdf" ? "PDF" : "NOTE",
                    materialId
                  ) as any)
                : null,
            status: "ENROLLED",
          },
          select: { id: true },
        });
        createdIds.push(created.id);
      }
      savedCount = createdIds.length;
      await enrollCards(tx, createdIds, "flashcard");
      return;
    }

    if (replace && materialId) {
      const oldQuestions = await tx.question.findMany({
        where: { materialId },
        select: { id: true },
      });
      const oldQuestionIds = oldQuestions.map((question: { id: string }) =>
        question.id
      );

      if (oldQuestionIds.length > 0) {
        const reviewsDeleted = await tx.cardReview.deleteMany({
          where: {
            cardId: { in: oldQuestionIds },
            resourceType: "question",
          },
        });
        deletedReviewsCount = reviewsDeleted.count;
      }

      const deleted = await tx.question.deleteMany({
        where: { materialId },
      });
      deletedCount = deleted.count;
    }

    if (result.length === 0) {
      savedCount = 0;
      return;
    }

    const createdIds: string[] = [];
    for (const question of result as QuizQuestionDTO[]) {
      const created = await tx.question.create({
        data: {
          workspaceId,
          materialId: materialId || null,
          question: question.question,
          choices: question.choices,
          answerIndex: question.answerIndex,
          sourceRef:
            materialId && question.sourceMetadata
              ? (extractSourceRef(
                  question.sourceMetadata,
                  loadedMaterialType === "pdf" ? "PDF" : "NOTE",
                  materialId
                ) as any)
              : null,
          status: "ENROLLED",
        },
        select: { id: true },
      });
      createdIds.push(created.id);
    }
    savedCount = createdIds.length;
    await enrollCards(tx, createdIds, "question");
  });

  return { savedCount, deletedCount, deletedReviewsCount };
}

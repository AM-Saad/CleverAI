import { extractSourceRef } from "../../../utils/contextBridge";
import type {
  FlashcardDTO,
  QuizQuestionDTO,
} from "../../../../shared/utils/llm-generate.contract";

export interface SaveGeneratedArtifactsInput {
  prisma: any;
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
    task,
    workspaceId,
    materialId,
    replace,
    loadedMaterialType,
    result,
  } = input;

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

      const created = await tx.flashcard.createMany({
        data: (result as FlashcardDTO[]).map((flashcard) => ({
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
          status: "DRAFT",
        })),
      });
      savedCount = created.count;
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

    const created = await tx.question.createMany({
      data: (result as QuizQuestionDTO[]).map((question) => ({
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
        status: "DRAFT",
      })),
    });
    savedCount = created.count;
  });

  return { savedCount, deletedCount, deletedReviewsCount };
}

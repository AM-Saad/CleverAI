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
  /** Existing active items removed from the replacement set. Kept for API compatibility. */
  deletedCount?: number;
  /** Review rows are retained and suspended so learning history is not destroyed. */
  deletedReviewsCount?: number;
}

const normalizedText = (value: string) => value.trim().replace(/\s+/g, " ");
const flashcardKey = (card: { front: string; back: string }) =>
  JSON.stringify([normalizedText(card.front), normalizedText(card.back)]);
const questionKey = (question: {
  question: string;
  choices: string[];
  answerIndex: number;
}) =>
  JSON.stringify([
    normalizedText(question.question),
    question.choices.map(normalizedText),
    question.answerIndex,
  ]);

export async function saveGeneratedArtifacts(
  input: SaveGeneratedArtifactsInput,
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
      let flashcardsToCreate = result as FlashcardDTO[];
      let preservedCount = 0;
      if (replace && materialId) {
        const oldFlashcards = await tx.flashcard.findMany({
          where: { materialId },
          select: {
            id: true,
            front: true,
            back: true,
            status: true,
          },
        });
        const availableByKey = new Map<string, typeof oldFlashcards>();
        for (const flashcard of oldFlashcards) {
          const key = flashcardKey(flashcard);
          availableByKey.set(key, [
            ...(availableByKey.get(key) ?? []),
            flashcard,
          ]);
        }
        const preservedIds: string[] = [];
        flashcardsToCreate = [];
        for (const flashcard of result as FlashcardDTO[]) {
          const matches = availableByKey.get(flashcardKey(flashcard));
          const match = matches?.shift();
          if (match) preservedIds.push(match.id);
          else flashcardsToCreate.push(flashcard);
        }
        const retiredIds = oldFlashcards
          .filter(
            (flashcard: { id: string; status: string }) =>
              flashcard.status === "ENROLLED" &&
              !preservedIds.includes(flashcard.id),
          )
          .map((flashcard: { id: string }) => flashcard.id);

        if (preservedIds.length) {
          await tx.flashcard.updateMany({
            where: { id: { in: preservedIds } },
            data: { status: "ENROLLED" },
          });
          await tx.cardReview.updateMany({
            where: {
              cardId: { in: preservedIds },
              resourceType: "flashcard",
            },
            data: { suspended: false },
          });
        }
        if (retiredIds.length) {
          await tx.flashcard.updateMany({
            where: { id: { in: retiredIds } },
            data: { status: "DRAFT" },
          });
          await tx.cardReview.updateMany({
            where: {
              cardId: { in: retiredIds },
              resourceType: "flashcard",
            },
            data: { suspended: true },
          });
        }
        preservedCount = preservedIds.length;
        deletedCount = retiredIds.length;
        deletedReviewsCount = 0;
      }

      if (result.length === 0 && !replace) {
        savedCount = 0;
        return;
      }

      // Create individually so we capture ids (MongoDB createMany returns none),
      // then auto-enroll the new cards into the review queue.
      const createdIds: string[] = [];
      for (const flashcard of flashcardsToCreate) {
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
                    materialId,
                  ) as any)
                : null,
            status: "ENROLLED",
          },
          select: { id: true },
        });
        createdIds.push(created.id);
      }
      savedCount = preservedCount + createdIds.length;
      await enrollCards(tx, createdIds, "flashcard");
      return;
    }

    let questionsToCreate = result as QuizQuestionDTO[];
    let preservedCount = 0;
    if (replace && materialId) {
      const oldQuestions = await tx.question.findMany({
        where: { materialId },
        select: {
          id: true,
          question: true,
          choices: true,
          answerIndex: true,
          status: true,
        },
      });
      const availableByKey = new Map<string, typeof oldQuestions>();
      for (const question of oldQuestions) {
        const key = questionKey(question);
        availableByKey.set(key, [...(availableByKey.get(key) ?? []), question]);
      }
      const preservedIds: string[] = [];
      questionsToCreate = [];
      for (const question of result as QuizQuestionDTO[]) {
        const matches = availableByKey.get(questionKey(question));
        const match = matches?.shift();
        if (match) preservedIds.push(match.id);
        else questionsToCreate.push(question);
      }
      const retiredIds = oldQuestions
        .filter(
          (question: { id: string; status: string }) =>
            question.status === "ENROLLED" &&
            !preservedIds.includes(question.id),
        )
        .map((question: { id: string }) => question.id);

      if (preservedIds.length) {
        await tx.question.updateMany({
          where: { id: { in: preservedIds } },
          data: { status: "ENROLLED" },
        });
        await tx.cardReview.updateMany({
          where: {
            cardId: { in: preservedIds },
            resourceType: "question",
          },
          data: { suspended: false },
        });
      }
      if (retiredIds.length) {
        await tx.question.updateMany({
          where: { id: { in: retiredIds } },
          data: { status: "DRAFT" },
        });
        await tx.cardReview.updateMany({
          where: {
            cardId: { in: retiredIds },
            resourceType: "question",
          },
          data: { suspended: true },
        });
      }
      preservedCount = preservedIds.length;
      deletedCount = retiredIds.length;
      deletedReviewsCount = 0;
    }

    if (result.length === 0 && !replace) {
      savedCount = 0;
      return;
    }

    const createdIds: string[] = [];
    for (const question of questionsToCreate) {
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
                  materialId,
                ) as any)
              : null,
          status: "ENROLLED",
        },
        select: { id: true },
      });
      createdIds.push(created.id);
    }
    savedCount = preservedCount + createdIds.length;
    await enrollCards(tx, createdIds, "question");
  });

  return { savedCount, deletedCount, deletedReviewsCount };
}

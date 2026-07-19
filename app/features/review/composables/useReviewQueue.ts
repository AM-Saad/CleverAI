import { useOperation } from "~/composables/shared/useOperation";
import type { APIError } from "~/services/FetchFactory";
import type {
  EnrollCardResponse,
  GradeCardResponse,
  ReviewCard,
  ReviewGrade,
} from "@shared/utils/review.contract";
import {
  calculateOfflineNextReviewDate,
  calculateOfflineSM2,
  calculateOfflineNextStreak,
} from "@@/shared/utils/sm2";
import { listOfflineEntities } from "~/utils/offline-v2/repository";
import { useOfflineRuntime } from "~/composables/offline/useOfflineRuntime";

export const useCardReview = () => {
  const { $api } = useNuxtApp();
  const offline = useOfflineRuntime();

  const reviewQueue = ref<ReviewCard[]>([]);
  const currentCard = ref<ReviewCard | null>(null);
  const currentCardIndex = ref(0);
  const queueStats = ref({
    total: 0,
    new: 0,
    due: 0,
    learning: 0,
  });
  const gradedCardIds = ref<Set<string>>(new Set());
  const requestIdsByCard = new Map<string, string>();
  let optimisticMutationId = 0;
  let queueEpoch = 0;
  let activeQueueKey = "__global__";

  const enrollOp = useOperation<EnrollCardResponse>();
  const fetchOp = useOperation<{
    cards: ReviewCard[];
    stats: typeof queueStats.value;
  }>();
  const gradeError = ref<APIError | null>(null);
  const pendingGradeIds = ref<Set<string>>(new Set());

  const isLoading = computed(() => fetchOp.pending.value);
  const isSubmitting = computed(
    () => enrollOp.pending.value || pendingGradeIds.value.size > 0,
  );
  const isGrading = computed(() => pendingGradeIds.value.size > 0);
  const error = computed(
    () => enrollOp.error.value?.message || fetchOp.error.value?.message || null,
  );

  const enroll = async (
    resourceType: "material" | "flashcard" | "question",
    resourceId: string,
  ): Promise<EnrollCardResponse | null> => {
    return enrollOp.execute(() =>
      $api.review.enroll({ resourceType, resourceId }),
    );
  };

  const setGradePending = (cardId: string, pending: boolean) => {
    const next = new Set(pendingGradeIds.value);
    if (pending) next.add(cardId);
    else next.delete(cardId);
    pendingGradeIds.value = next;
  };

  const removeCardFromQueue = (
    cardId: string,
  ): { card: ReviewCard; index: number } | null => {
    const cardIndex = reviewQueue.value.findIndex(
      (card) => card.cardId === cardId,
    );
    if (cardIndex === -1) return null;

    const nextQueue = [...reviewQueue.value];
    const [card] = nextQueue.splice(cardIndex, 1);
    if (!card) return null;

    reviewQueue.value = nextQueue;
    queueStats.value = {
      ...queueStats.value,
      due: Math.max(0, queueStats.value.due - 1),
    };

    const len = nextQueue.length;
    let nextIndex = currentCardIndex.value;
    if (len === 0) {
      nextIndex = 0;
    } else if (cardIndex < currentCardIndex.value) {
      nextIndex = Math.max(0, currentCardIndex.value - 1);
    } else if (cardIndex === currentCardIndex.value) {
      nextIndex = Math.min(cardIndex, len - 1);
    } else if (currentCardIndex.value >= len) {
      nextIndex = len - 1;
    }

    currentCardIndex.value = nextIndex;
    currentCard.value = nextQueue[nextIndex] ?? null;
    return { card, index: cardIndex };
  };

  const restoreFailedCard = (
    removed: { card: ReviewCard; index: number } | null,
    queueKey: string,
  ) => {
    if (!removed || queueKey !== activeQueueKey) return;
    if (reviewQueue.value.some((card) => card.cardId === removed.card.cardId)) {
      return;
    }

    const nextQueue = [...reviewQueue.value];
    const insertIndex = currentCard.value
      ? Math.min(currentCardIndex.value + 1, nextQueue.length)
      : Math.min(removed.index, nextQueue.length);
    nextQueue.splice(insertIndex, 0, removed.card);
    reviewQueue.value = nextQueue;
    queueStats.value = {
      ...queueStats.value,
      due: queueStats.value.due + 1,
    };

    if (!currentCard.value) {
      currentCardIndex.value = insertIndex;
      currentCard.value = nextQueue[insertIndex] ?? null;
    }
  };

  const grade = async (
    cardId: string,
    gradeValue: ReviewGrade,
    requestId?: string,
  ): Promise<GradeCardResponse | null> => {
    if (
      pendingGradeIds.value.size > 0 ||
      pendingGradeIds.value.has(cardId) ||
      gradedCardIds.value.has(cardId)
    ) {
      return null;
    }

    const removed = removeCardFromQueue(cardId);
    if (!removed) return null;

    const stableRequestId =
      requestIdsByCard.get(cardId) ??
      requestId ??
      globalThis.crypto?.randomUUID?.() ??
      `${cardId}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    requestIdsByCard.set(cardId, stableRequestId);

    const mutationId = ++optimisticMutationId;
    const queueKey = activeQueueKey;
    const nextGradedIds = new Set(gradedCardIds.value);
    nextGradedIds.add(cardId);
    gradedCardIds.value = nextGradedIds;
    setGradePending(cardId, true);
    gradeError.value = null;

    try {
      if (!offline.isOnline.value) {
        const card = removed?.card;
        if (!card) return null;
        const reviewedAt = new Date();
        const next = calculateOfflineSM2({
          currentEF: card.reviewState.easeFactor,
          currentInterval: card.reviewState.intervalDays,
          currentRepetitions: card.reviewState.repetitions,
          grade: Number(gradeValue),
        });
        await offline.queue({
          entity: "review",
          operation: "review.grade",
          entityId: cardId,
          workspaceId:
            "workspaceId" in card.resource
              ? card.resource.workspaceId
              : undefined,
          changedFields: ["reviewState"],
          payload: {
            cardId,
            grade: Number(gradeValue),
            reviewedAt: reviewedAt.toISOString(),
            requestId: stableRequestId,
          },
          // Persist the provisional schedule in the same transaction as the
          // grade event. A reload must never put an already-answered card back
          // in the offline queue.
          localData: {
            intervalDays: next.intervalDays,
            easeFactor: next.easeFactor,
            repetitions: next.repetitions,
            nextReviewAt: calculateOfflineNextReviewDate(
              next.intervalDays,
              reviewedAt,
            ).toISOString(),
            lastReviewedAt: reviewedAt.toISOString(),
            lastGrade: Number(gradeValue),
            streak: calculateOfflineNextStreak(
              card.reviewState.streak ?? 0,
              Number(gradeValue),
            ),
          },
          sequence: true,
        });
        requestIdsByCard.delete(cardId);
        return {
          success: true,
          nextReviewAt: calculateOfflineNextReviewDate(
            next.intervalDays,
            reviewedAt,
          ).toISOString(),
          intervalDays: next.intervalDays,
          easeFactor: next.easeFactor,
          message: "Saved locally",
        };
      }
      const result = await $api.review.grade({
        cardId,
        grade: gradeValue,
        requestId: stableRequestId,
      });
      if (result.success) {
        requestIdsByCard.delete(cardId);
        if (mutationId === optimisticMutationId) gradeError.value = null;
        return result.data;
      }

      const failedGradedIds = new Set(gradedCardIds.value);
      failedGradedIds.delete(cardId);
      gradedCardIds.value = failedGradedIds;
      gradeError.value = result.error;
      restoreFailedCard(removed, queueKey);
      return null;
    } catch (err) {
      const failedGradedIds = new Set(gradedCardIds.value);
      failedGradedIds.delete(cardId);
      gradedCardIds.value = failedGradedIds;
      gradeError.value = err as APIError;
      restoreFailedCard(removed, queueKey);
      return null;
    } finally {
      setGradePending(cardId, false);
    }
  };

  const fetchQueue = async (
    workspaceId?: string,
    limit: number = 20,
  ): Promise<void> => {
    const epoch = ++queueEpoch;
    const queueKey = workspaceId ?? "__global__";
    if (!offline.isOnline.value && offline.accountId.value) {
      const cached = await listOfflineEntities<Record<string, any>>(
        offline.accountId.value,
        "review",
        workspaceId,
      );
      if (epoch !== queueEpoch) return;
      const cards: ReviewCard[] = cached
        .map((record) => {
          const review = record.data;
          const resource = review.offlineResource;
          if (!resource) return null;
          const resourceType = String(
            review.resourceType ?? "flashcard",
          ) as ReviewCard["resourceType"];
          const normalizedResource =
            resourceType === "material"
              ? {
                  title: resource.title,
                  content: resource.content,
                  tags: [],
                  workspaceId: resource.workspaceId,
                }
              : resourceType === "question"
                ? {
                    question: resource.question,
                    choices: resource.choices,
                    answerIndex: resource.answerIndex,
                    workspaceId: resource.workspaceId,
                  }
                : {
                    front: resource.front,
                    back: resource.back,
                    hint: undefined,
                    tags: [],
                    workspaceId: resource.workspaceId,
                  };
          return {
            cardId: review.id,
            resourceType,
            resourceId: review.cardId,
            resource: normalizedResource,
            reviewState: {
              repetitions: review.repetitions,
              easeFactor: review.easeFactor,
              intervalDays: review.intervalDays,
              nextReviewAt: review.nextReviewAt,
              lastReviewedAt: review.lastReviewedAt,
            },
          } as ReviewCard;
        })
        .filter((card): card is ReviewCard => Boolean(card))
        .filter(
          (card) =>
            new Date(card.reviewState.nextReviewAt).getTime() <= Date.now(),
        )
        .filter(
          (card) =>
            !pendingGradeIds.value.has(card.cardId) &&
            !gradedCardIds.value.has(card.cardId),
        )
        .slice(0, limit);
      activeQueueKey = queueKey;
      reviewQueue.value = cards;
      queueStats.value = {
        total: cached.length,
        new: cached.filter(
          (record) => Number(record.data.repetitions ?? 0) === 0,
        ).length,
        due: cards.length,
        learning: cached.filter(
          (record) =>
            Number(record.data.repetitions ?? 0) > 0 &&
            Number(record.data.repetitions ?? 0) < 3,
        ).length,
      };
      currentCardIndex.value = 0;
      currentCard.value = cards[0] ?? null;
      return;
    }
    const response = await fetchOp.execute(() =>
      $api.review.getQueue(workspaceId, limit),
    );

    if (response && epoch === queueEpoch) {
      activeQueueKey = queueKey;
      optimisticMutationId++;
      const nextCards = response.cards.filter(
        (card) =>
          !pendingGradeIds.value.has(card.cardId) &&
          !gradedCardIds.value.has(card.cardId),
      );
      const hiddenPendingCards = response.cards.length - nextCards.length;
      reviewQueue.value = nextCards;
      queueStats.value = {
        ...response.stats,
        due: Math.max(0, response.stats.due - hiddenPendingCards),
      };

      if (reviewQueue.value.length > 0) {
        currentCardIndex.value = 0;
        currentCard.value = reviewQueue.value[0] ?? null;
      } else {
        currentCard.value = null;
        currentCardIndex.value = 0;
      }
    }
  };

  const nextCard = (): void => {
    if (currentCardIndex.value < reviewQueue.value.length - 1) {
      currentCardIndex.value++;
      currentCard.value = reviewQueue.value[currentCardIndex.value] ?? null;
    }
  };

  const previousCard = (): void => {
    if (currentCardIndex.value > 0) {
      currentCardIndex.value--;
      currentCard.value = reviewQueue.value[currentCardIndex.value] ?? null;
    }
  };

  const goToCard = (index: number): void => {
    if (index >= 0 && index < reviewQueue.value.length) {
      currentCardIndex.value = index;
      currentCard.value = reviewQueue.value[index] ?? null;
    }
  };

  const clearError = (): void => {
    enrollOp.reset();
    fetchOp.reset();
    gradeError.value = null;
  };

  const reset = (): void => {
    optimisticMutationId++;
    queueEpoch++;
    activeQueueKey = "__reset__";
    reviewQueue.value = [];
    currentCard.value = null;
    currentCardIndex.value = 0;
    queueStats.value = { total: 0, new: 0, due: 0, learning: 0 };
    pendingGradeIds.value = new Set();
    gradedCardIds.value = new Set();
    requestIdsByCard.clear();
    clearError();
  };

  const hasCards = computed(() => reviewQueue.value.length > 0);
  const isFirstCard = computed(() => currentCardIndex.value === 0);
  const isLastCard = computed(
    () => currentCardIndex.value === reviewQueue.value.length - 1,
  );
  const progress = computed(() => {
    if (reviewQueue.value.length === 0) return 0;
    return Math.round(
      ((currentCardIndex.value + 1) / reviewQueue.value.length) * 100,
    );
  });

  return {
    reviewQueue: readonly(reviewQueue),
    currentCard: readonly(currentCard),
    currentCardIndex: readonly(currentCardIndex),
    queueStats: readonly(queueStats),
    isLoading: readonly(isLoading),
    isSubmitting: readonly(isSubmitting),
    isGrading: readonly(isGrading),
    error: readonly(error),
    gradeError: readonly(gradeError),
    hasCards,
    isFirstCard,
    isLastCard,
    progress,
    enroll,
    grade,
    fetchQueue,
    nextCard,
    previousCard,
    goToCard,
    clearError,
    reset,
  };
};

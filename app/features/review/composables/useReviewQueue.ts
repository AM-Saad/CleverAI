import { useOperation } from "~/composables/shared/useOperation";
import type {
  EnrollCardResponse,
  GradeCardResponse,
  ReviewCard,
  ReviewGrade,
} from "@shared/utils/review.contract";

export const useCardReview = () => {
  const { $api } = useNuxtApp();

  const reviewQueue = ref<ReviewCard[]>([]);
  const currentCard = ref<ReviewCard | null>(null);
  const currentCardIndex = ref(0);
  const queueStats = ref({
    total: 0,
    new: 0,
    due: 0,
    learning: 0,
  });

  const enrollOp = useOperation<EnrollCardResponse>();
  const gradeOp = useOperation<GradeCardResponse>();
  const fetchOp = useOperation<{
    cards: ReviewCard[];
    stats: typeof queueStats.value;
  }>();

  const isLoading = computed(() => fetchOp.pending.value);
  const isSubmitting = computed(
    () => enrollOp.pending.value || gradeOp.pending.value,
  );
  const error = computed(
    () =>
      enrollOp.error.value?.message ||
      gradeOp.error.value?.message ||
      fetchOp.error.value?.message ||
      null,
  );

  const enroll = async (
    resourceType: "material" | "flashcard" | "question",
    resourceId: string,
  ): Promise<EnrollCardResponse | null> => {
    return enrollOp.execute(() =>
      $api.review.enroll({ resourceType, resourceId }),
    );
  };

  const grade = async (
    cardId: string,
    grade: ReviewGrade,
  ): Promise<GradeCardResponse | null> => {
    const response = await gradeOp.execute(() =>
      $api.review.grade({ cardId, grade }),
    );

    if (response) {
      const queue = reviewQueue.value;
      const cardIndex = queue.findIndex((card) => card.cardId === cardId);

      if (cardIndex !== -1) {
        queue.splice(cardIndex, 1);
        queueStats.value.due = Math.max(0, queueStats.value.due - 1);

        const len = queue.length;
        const newIndex =
          currentCardIndex.value >= len
            ? Math.max(0, len - 1)
            : currentCardIndex.value;
        currentCardIndex.value = newIndex;
        currentCard.value = queue[newIndex] ?? null;
      }
    }

    return response;
  };

  const fetchQueue = async (
    workspaceId?: string,
    limit: number = 20,
  ): Promise<void> => {
    const response = await fetchOp.execute(() =>
      $api.review.getQueue(workspaceId, limit),
    );

    if (response) {
      reviewQueue.value = response.cards;
      queueStats.value = response.stats;

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
    gradeOp.reset();
    fetchOp.reset();
  };

  const reset = (): void => {
    reviewQueue.value = [];
    currentCard.value = null;
    currentCardIndex.value = 0;
    queueStats.value = { total: 0, new: 0, due: 0, learning: 0 };
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
    error: readonly(error),
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

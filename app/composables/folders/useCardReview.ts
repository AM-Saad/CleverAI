import { useOperation } from "../shared/useOperation";

export const useCardReview = () => {
  // Get API service
  const { $api } = useNuxtApp();

  // Reactive state
  const reviewQueue = ref<ReviewCard[]>([]);
  const currentCard = ref<ReviewCard | null>(null);
  const currentCardIndex = ref(0);
  const queueStats = ref({
    total: 0,
    new: 0,
    due: 0,
    learning: 0,
  });

  // Use Result-pattern operations instead of manual try/catch
  const enrollOp = useOperation<EnrollCardResponse>();
  const gradeOp = useOperation<GradeCardResponse>();
  const fetchOp = useOperation<{
    cards: ReviewCard[];
    stats: typeof queueStats.value;
  }>();

  // Combined loading/error states from all operations
  const isLoading = computed(() => fetchOp.pending.value);
  const isSubmitting = computed(
    () => enrollOp.pending.value || gradeOp.pending.value
  );
  const error = computed(
    () =>
      enrollOp.error.value?.message ||
      gradeOp.error.value?.message ||
      fetchOp.error.value?.message ||
      null
  );

  // Enroll a resource as a review card
  const enroll = async (
    resourceType: "material" | "flashcard",
    resourceId: string
  ): Promise<EnrollCardResponse | null> => {
    return enrollOp.execute(() =>
      $api.review.enroll({ resourceType, resourceId })
    );
  };

  // Grade a card
  const grade = async (
    cardId: string,
    grade: ReviewGrade
  ): Promise<GradeCardResponse | null> => {
    const response = await gradeOp.execute(() =>
      $api.review.grade({ cardId, grade })
    );

    if (response) {
      // Remove the graded card from the queue
      const cardIndex = reviewQueue.value.findIndex(
        (card) => card.cardId === cardId
      );
      if (cardIndex !== -1) {
        reviewQueue.value.splice(cardIndex, 1);
        queueStats.value.due = Math.max(0, queueStats.value.due - 1);

        // Update current card index if needed
        if (currentCardIndex.value >= reviewQueue.value.length) {
          currentCardIndex.value = Math.max(0, reviewQueue.value.length - 1);
        }

        // Update current card
        if (reviewQueue.value.length > 0) {
          currentCard.value = reviewQueue.value[currentCardIndex.value] || null;
        } else {
          currentCard.value = null;
          currentCardIndex.value = 0;
        }
      }
    }

    return response;
  };

  // Fetch review queue
  const fetchQueue = async (
    folderId?: string,
    limit: number = 20
  ): Promise<void> => {
    const response = await fetchOp.execute(() =>
      $api.review.getQueue(folderId, limit)
    );

    if (response) {
      reviewQueue.value = response.cards;
      queueStats.value = response.stats;

      // Set current card
      if (reviewQueue.value.length > 0) {
        currentCardIndex.value = 0;
        currentCard.value = reviewQueue.value[0] || null;
      } else {
        currentCard.value = null;
        currentCardIndex.value = 0;
      }
    }
  };

  // Navigate to next card
  const nextCard = (): void => {
    if (currentCardIndex.value < reviewQueue.value.length - 1) {
      currentCardIndex.value++;
      currentCard.value = reviewQueue.value[currentCardIndex.value] || null;
    }
  };

  // Navigate to previous card
  const previousCard = (): void => {
    if (currentCardIndex.value > 0) {
      currentCardIndex.value--;
      currentCard.value = reviewQueue.value[currentCardIndex.value] || null;
    }
  };

  // Jump to specific card
  const goToCard = (index: number): void => {
    if (index >= 0 && index < reviewQueue.value.length) {
      currentCardIndex.value = index;
      currentCard.value = reviewQueue.value[index] || null;
    }
  };

  // Clear error
  const clearError = (): void => {
    enrollOp.reset();
    gradeOp.reset();
    fetchOp.reset();
  };

  // Reset state
  const reset = (): void => {
    reviewQueue.value = [];
    currentCard.value = null;
    currentCardIndex.value = 0;
    queueStats.value = { total: 0, new: 0, due: 0, learning: 0 };
    clearError();
  };

  // Computed properties
  const hasCards = computed(() => reviewQueue.value.length > 0);
  const isFirstCard = computed(() => currentCardIndex.value === 0);
  const isLastCard = computed(
    () => currentCardIndex.value === reviewQueue.value.length - 1
  );
  const progress = computed(() => {
    if (reviewQueue.value.length === 0) return 0;
    return Math.round(
      ((currentCardIndex.value + 1) / reviewQueue.value.length) * 100
    );
  });

  return {
    // State
    reviewQueue: readonly(reviewQueue),
    currentCard: readonly(currentCard),
    currentCardIndex: readonly(currentCardIndex),
    queueStats: readonly(queueStats),
    isLoading: readonly(isLoading),
    isSubmitting: readonly(isSubmitting),
    error: readonly(error),

    // Computed
    hasCards,
    isFirstCard,
    isLastCard,
    progress,

    // Actions
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

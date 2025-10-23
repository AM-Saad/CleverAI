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

  // Loading and error states
  const isLoading = ref(false);
  const isSubmitting = ref(false);
  const error = ref<string | null>(null);

  // Enroll a resource as a review card
  const enroll = async (
    resourceType: "material" | "flashcard",
    resourceId: string,
  ): Promise<EnrollCardResponse> => {
    isSubmitting.value = true;
    error.value = null;

    try {
      const result = await $api.review.enroll({ resourceType, resourceId });

      if (result.success) {
        return result.data;
      } else {
        error.value = result.error.message;
        throw new Error(result.error.message);
      }
    } catch (err: unknown) {
      const errorMsg =
        err instanceof Error ? err.message : "Failed to enroll card";
      error.value = errorMsg;
      throw err;
    } finally {
      isSubmitting.value = false;
    }
  };

  // Grade a card
  const grade = async (
    cardId: string,
    grade: ReviewGrade,
  ): Promise<GradeCardResponse> => {
    isSubmitting.value = true;
    error.value = null;

    try {
      const result = await $api.review.grade({ cardId, grade });

      if (result.success) {
        const response = result.data;

        // Remove the graded card from the queue
        const cardIndex = reviewQueue.value.findIndex(
          (card) => card.cardId === cardId,
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
            currentCard.value =
              reviewQueue.value[currentCardIndex.value] || null;
          } else {
            currentCard.value = null;
            currentCardIndex.value = 0;
          }
        }

        return response;
      } else {
        error.value = result.error.message;
        throw new Error(result.error.message);
      }
    } catch (err: unknown) {
      const errorMsg =
        err instanceof Error ? err.message : "Failed to grade card";
      error.value = errorMsg;
      throw err;
    } finally {
      isSubmitting.value = false;
    }
  };

  // Fetch review queue
  const fetchQueue = async (
    folderId?: string,
    limit: number = 20,
  ): Promise<void> => {
    isLoading.value = true;
    error.value = null;

    try {
      const result = await $api.review.getQueue(folderId, limit);

      if (result.success) {
        const response = result.data;
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
      } else {
        error.value = result.error.message;
        throw new Error(result.error.message);
      }
    } catch (err: unknown) {
      const errorMsg =
        err instanceof Error ? err.message : "Failed to fetch review queue";
      error.value = errorMsg;
      throw err;
    } finally {
      isLoading.value = false;
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
    error.value = null;
  };

  // Reset state
  const reset = (): void => {
    reviewQueue.value = [];
    currentCard.value = null;
    currentCardIndex.value = 0;
    queueStats.value = { total: 0, new: 0, due: 0, learning: 0 };
    error.value = null;
    isLoading.value = false;
    isSubmitting.value = false;
  };

  // Computed properties
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

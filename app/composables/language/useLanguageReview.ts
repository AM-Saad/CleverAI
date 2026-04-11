import type { LanguageQueueCard, LanguageGradeRequest } from "@shared/utils/language.contract";

export function useLanguageReview() {
  const { $api } = useNuxtApp();

  const queue = ref<LanguageQueueCard[]>([]);
  const currentIndex = ref(0);
  const isComplete = ref(false);

  const fetchOperation = useOperation<{ cards: LanguageQueueCard[] }>();
  const gradeOperation = useOperation<{
    nextReviewAt: string;
    intervalDays: number;
    easeFactor: number;
    xpEarned: number;
  }>();

  const currentCard = computed(() => queue.value[currentIndex.value] ?? null);
  const totalCards = computed(() => queue.value.length);
  const remainingCards = computed(() => queue.value.length - currentIndex.value);
  const progress = computed(() =>
    totalCards.value > 0
      ? Math.round((currentIndex.value / totalCards.value) * 100)
      : 0
  );

  const fetchQueue = async () => {
    isComplete.value = false;
    currentIndex.value = 0;
    queue.value = [];

    const result = await fetchOperation.execute(() => $api.language.getQueue());
    if (result) {
      queue.value = result.cards;
      if (result.cards.length === 0) {
        isComplete.value = true;
      }
    }
    return result;
  };

  const grade = async (cardId: string, gradeValue: "0" | "1" | "2" | "3" | "4" | "5") => {
    const payload: LanguageGradeRequest = {
      cardId,
      grade: gradeValue,
      requestId: `${cardId}-${Date.now()}`,
    };

    const result = await gradeOperation.execute(() => $api.language.gradeCard(payload));

    if (result) {
      nextCard();
    }

    return result;
  };

  const nextCard = () => {
    if (currentIndex.value < queue.value.length - 1) {
      currentIndex.value++;
    } else {
      isComplete.value = true;
    }
  };

  const previousCard = () => {
    if (currentIndex.value > 0) {
      currentIndex.value--;
    }
  };

  // TTS helper — uses the existing TTS worker composable
  const ttsWorker = useTextToSpeechWorker();

  const speakWord = (text: string) => {
    return ttsWorker.synthesize(text);
  };

  return {
    // State
    queue: readonly(queue),
    currentCard,
    currentIndex: readonly(currentIndex),
    totalCards,
    remainingCards,
    progress,
    isComplete: readonly(isComplete),

    // Operation state
    isLoading: fetchOperation.pending,
    fetchError: fetchOperation.error,
    isGrading: gradeOperation.pending,
    gradeError: gradeOperation.error,

    // TTS
    ttsAudioUrl: ttsWorker.audioUrl,
    isSpeaking: ttsWorker.isSynthesizing,

    // Actions
    fetchQueue,
    grade,
    nextCard,
    previousCard,
    speakWord,
  };
}

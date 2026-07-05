import type {
  LanguageQueueCard,
  LanguageGradeRequest,
} from "@shared/utils/language.contract";
import type { ReviewGrade } from "@shared/utils/review.contract";
import type { APIError } from "~/services/FetchFactory";
import { useTextToSpeechWorker } from "~/composables/ai/useTextToSpeechWorker";
import { useLanguageLearningRuntime } from "./languageLearningRuntime";

export function useLanguageReview() {
  const { $api } = useNuxtApp();
  const languageRuntime = useLanguageLearningRuntime();

  const queue = ref<LanguageQueueCard[]>([]);
  const currentIndex = ref(0);
  const isComplete = ref(false);
  const gradedCardIds = ref(new Set<string>());
  const requestIdsByCard = new Map<string, string>();
  let optimisticGradeId = 0;
  let sessionEpoch = 0;

  const fetchOperation = useOperation<{ cards: LanguageQueueCard[] }>();
  const gradeError = ref<APIError | null>(null);
  const pendingGradeIds = ref<Set<string>>(new Set());

  const currentCard = computed(() =>
    isComplete.value ? null : (queue.value[currentIndex.value] ?? null),
  );
  const totalCards = computed(() => queue.value.length);
  const remainingCards = computed(() =>
    isComplete.value ? 0 : Math.max(0, queue.value.length - currentIndex.value),
  );
  const progress = computed(() =>
    totalCards.value > 0
      ? isComplete.value
        ? 100
        : Math.round((currentIndex.value / totalCards.value) * 100)
      : 0,
  );

  const fetchQueue = async () => {
    sessionEpoch++;
    optimisticGradeId++;
    isComplete.value = false;
    currentIndex.value = 0;
    queue.value = [];
    gradedCardIds.value = new Set();
    pendingGradeIds.value = new Set();
    gradeError.value = null;
    requestIdsByCard.clear();
    await languageRuntime.ensurePreferences();

    const result = await fetchOperation.execute(() =>
      $api.language.getQueue({
        targetLanguage: languageRuntime.preferences.value?.targetLanguage,
        nativeLanguage: languageRuntime.preferences.value?.nativeLanguage,
      }),
    );
    if (result) {
      queue.value = result.cards;
      if (result.cards.length === 0) {
        isComplete.value = true;
      }
    }
    return result;
  };

  const setGradePending = (cardId: string, pending: boolean) => {
    const next = new Set(pendingGradeIds.value);
    if (pending) next.add(cardId);
    else next.delete(cardId);
    pendingGradeIds.value = next;
  };

  const removeCardFromQueue = (
    cardId: string,
  ): { card: LanguageQueueCard; index: number } | null => {
    const cardIndex = queue.value.findIndex((card) => card.cardId === cardId);
    if (cardIndex === -1) return null;

    const nextQueue = [...queue.value];
    const [card] = nextQueue.splice(cardIndex, 1);
    if (!card) return null;

    queue.value = nextQueue;
    const len = nextQueue.length;
    if (len === 0) {
      currentIndex.value = 0;
      isComplete.value = true;
    } else if (cardIndex < currentIndex.value) {
      currentIndex.value = Math.max(0, currentIndex.value - 1);
      isComplete.value = false;
    } else if (cardIndex === currentIndex.value) {
      currentIndex.value = Math.min(cardIndex, len - 1);
      isComplete.value = false;
    } else if (currentIndex.value >= len) {
      currentIndex.value = len - 1;
      isComplete.value = false;
    }

    return { card, index: cardIndex };
  };

  const restoreFailedCard = (
    removed: { card: LanguageQueueCard; index: number } | null,
    epoch: number,
  ) => {
    if (!removed || epoch !== sessionEpoch) return;
    if (queue.value.some((card) => card.cardId === removed.card.cardId)) return;

    const nextQueue = [...queue.value];
    const insertIndex = currentCard.value
      ? Math.min(currentIndex.value + 1, nextQueue.length)
      : Math.min(removed.index, nextQueue.length);
    nextQueue.splice(insertIndex, 0, removed.card);
    queue.value = nextQueue;
    isComplete.value = false;

    if (!currentCard.value) {
      currentIndex.value = insertIndex;
    }
  };

  const grade = async (cardId: string, gradeValue: ReviewGrade) => {
    if (pendingGradeIds.value.has(cardId) || gradedCardIds.value.has(cardId)) {
      return null;
    }
    if (!requestIdsByCard.has(cardId)) {
      const uniquePart =
        globalThis.crypto?.randomUUID?.() ??
        `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      requestIdsByCard.set(cardId, `${cardId}-${uniquePart}`);
    }
    const payload: LanguageGradeRequest = {
      cardId,
      grade: gradeValue,
      requestId: requestIdsByCard.get(cardId),
    };

    const mutationId = ++optimisticGradeId;
    const epoch = sessionEpoch;
    const nextGraded = new Set(gradedCardIds.value);
    nextGraded.add(cardId);
    gradedCardIds.value = nextGraded;
    const removed = removeCardFromQueue(cardId);
    setGradePending(cardId, true);
    gradeError.value = null;

    try {
      const result = await $api.language.gradeCard(payload);
      if (!result.success) {
        const nextGradedIds = new Set(gradedCardIds.value);
        nextGradedIds.delete(cardId);
        gradedCardIds.value = nextGradedIds;
        gradeError.value = result.error;
        restoreFailedCard(removed, epoch);
        return null;
      }

      requestIdsByCard.delete(cardId);
      languageRuntime.invalidateWords();
      void languageRuntime.refreshStats();
      if (mutationId === optimisticGradeId) gradeError.value = null;
      return result.data;
    } catch (err) {
      const nextGradedIds = new Set(gradedCardIds.value);
      nextGradedIds.delete(cardId);
      gradedCardIds.value = nextGradedIds;
      gradeError.value = err as APIError;
      restoreFailedCard(removed, epoch);
      return null;
    } finally {
      setGradePending(cardId, false);
    }
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
  let activeAudio: HTMLAudioElement | null = null;

  const speakWord = async (text: string, lang = "en") => {
    try {
      const audioUrl = await ttsWorker.synthesize(text, lang);
      if (!audioUrl) return audioUrl;
      if (activeAudio) {
        activeAudio.pause();
        activeAudio.currentTime = 0;
      }
      activeAudio = new Audio(audioUrl);
      await activeAudio.play();
      return audioUrl;
    } catch (err) {
      console.warn("[language] Text to speech failed", err);
      return null;
    }
  };

  onBeforeUnmount(() => {
    if (activeAudio) {
      activeAudio.pause();
      activeAudio.currentTime = 0;
      activeAudio = null;
    }
  });

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
    isGrading: computed(() =>
      currentCard.value
        ? pendingGradeIds.value.has(currentCard.value.cardId)
        : false,
    ),
    hasPendingGrades: computed(() => pendingGradeIds.value.size > 0),
    gradeError: readonly(gradeError),

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

import type {
  LanguageQueueCard,
  LanguageGradeRequest,
} from "@shared/utils/language.contract";
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

  const fetchOperation = useOperation<{ cards: LanguageQueueCard[] }>();
  const gradeOperation = useOperation<{
    nextReviewAt: string;
    intervalDays: number;
    easeFactor: number;
    xpEarned: number;
  }>();

  const currentCard = computed(() => queue.value[currentIndex.value] ?? null);
  const totalCards = computed(() => queue.value.length);
  const remainingCards = computed(
    () => queue.value.length - currentIndex.value,
  );
  const progress = computed(() =>
    totalCards.value > 0
      ? Math.round((currentIndex.value / totalCards.value) * 100)
      : 0,
  );

  const fetchQueue = async () => {
    isComplete.value = false;
    currentIndex.value = 0;
    queue.value = [];
    gradedCardIds.value = new Set();
    requestIdsByCard.clear();

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

  const grade = async (
    cardId: string,
    gradeValue: "0" | "1" | "2" | "3" | "4" | "5",
  ) => {
    if (gradeOperation.pending.value || gradedCardIds.value.has(cardId)) {
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

    const result = await gradeOperation.execute(() =>
      $api.language.gradeCard(payload),
    );

    if (result) {
      const nextGraded = new Set(gradedCardIds.value);
      nextGraded.add(cardId);
      gradedCardIds.value = nextGraded;
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

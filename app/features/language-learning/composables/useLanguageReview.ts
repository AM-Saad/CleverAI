import type {
  LanguageQueueCard,
  LanguageGradeRequest,
} from "@shared/utils/language.contract";
import type { ReviewGrade } from "@shared/utils/review.contract";
import type { APIError } from "~/services/FetchFactory";
import { useTextToSpeechWorker } from "~/composables/ai/useTextToSpeechWorker";
import { useLanguageLearningRuntime } from "./languageLearningRuntime";
import {
  calculateOfflineNextReviewDate,
  calculateOfflineNextStreak,
  calculateOfflineSM2,
} from "@@/shared/utils/sm2";
import {
  listOfflineEntities,
  listOfflineMutations,
} from "~/utils/offline-v2/repository";
import { useOfflineRuntime } from "~/composables/offline/useOfflineRuntime";

export function useLanguageReview() {
  const { $api } = useNuxtApp();
  const languageRuntime = useLanguageLearningRuntime();
  const offline = useOfflineRuntime();

  const queue = ref<LanguageQueueCard[]>([]);
  const currentIndex = ref(0);
  const isComplete = ref(false);
  const gradedCardIds = ref(new Set<string>());
  const requestIdsByCard = new Map<string, string>();
  const offlineReviewDataById = new Map<string, Record<string, any>>();
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
    const epoch = ++sessionEpoch;
    optimisticGradeId++;
    isComplete.value = false;
    currentIndex.value = 0;
    queue.value = [];
    gradedCardIds.value = new Set();
    pendingGradeIds.value = new Set();
    gradeError.value = null;
    requestIdsByCard.clear();
    offlineReviewDataById.clear();
    await languageRuntime.ensurePreferences();
    if (epoch !== sessionEpoch) return null;

    if (!offline.isOnline.value && offline.accountId.value) {
      const [reviews, words] = await Promise.all([
        listOfflineEntities<Record<string, any>>(
          offline.accountId.value,
          "languageReview",
        ),
        listOfflineEntities<Record<string, any>>(
          offline.accountId.value,
          "languageWord",
        ),
      ]);
      if (epoch !== sessionEpoch) return null;
      const wordsById = new Map(
        words.map((record) => [record.entityId, record.data]),
      );
      const preferences = languageRuntime.preferences.value;
      const allDueCards = reviews
        .filter(
          (record) =>
            new Date(record.data.nextReviewAt).getTime() <= Date.now() &&
            !record.data.suspended,
        )
        .map((record) => {
          const review = record.data;
          const word = wordsById.get(review.wordId);
          if (!word) return null;
          offlineReviewDataById.set(record.entityId, review);
          const story = Array.isArray(word.stories)
            ? word.stories.find(
                (candidate: any) => candidate.id === review.storyId,
              )
            : null;
          return {
            cardId: review.id,
            wordId: word.id,
            word: word.word,
            translation: word.translation,
            sourceLang: word.sourceLang,
            translationLang: word.translationLang,
            storyId: story?.id ?? null,
            storyText: story?.storyText ?? null,
            sentences: story?.sentences ?? null,
            mode: story ? "story_cloze" : "word_translation",
            reviewState: {
              intervalDays: review.intervalDays,
              easeFactor: review.easeFactor,
              repetitions: review.repetitions,
              nextReviewAt: new Date(review.nextReviewAt),
              lastGrade: review.lastGrade,
              streak: review.streak,
            },
          } as LanguageQueueCard;
        })
        .filter((card): card is LanguageQueueCard => Boolean(card));
      const scopedCards = allDueCards.filter(
        (card) =>
          (!preferences?.targetLanguage ||
            preferences.targetLanguage === preferences.nativeLanguage ||
            card.sourceLang === preferences.targetLanguage) &&
          (!preferences?.nativeLanguage ||
            card.translationLang === preferences.nativeLanguage),
      );
      const cards = (scopedCards.length > 0 ? scopedCards : allDueCards)
        .sort(
          (left, right) =>
            left.reviewState.nextReviewAt.getTime() -
            right.reviewState.nextReviewAt.getTime(),
        )
        .slice(0, preferences?.sessionCardLimit ?? 20);
      queue.value = cards;
      isComplete.value = cards.length === 0;
      return { cards };
    }

    const result = await fetchOperation.execute(() =>
      $api.language.getQueue({
        targetLanguage: languageRuntime.preferences.value?.targetLanguage,
        nativeLanguage: languageRuntime.preferences.value?.nativeLanguage,
      }),
    );
    if (epoch !== sessionEpoch) return null;
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
    if (
      pendingGradeIds.value.size > 0 ||
      pendingGradeIds.value.has(cardId) ||
      gradedCardIds.value.has(cardId)
    ) {
      return null;
    }

    const removed = removeCardFromQueue(cardId);
    if (!removed) return null;

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
        const nextReviewAt = calculateOfflineNextReviewDate(
          next.intervalDays,
          reviewedAt,
        );
        const existingReview = offlineReviewDataById.get(cardId) ?? {
          id: cardId,
          userId: offline.accountId.value,
          wordId: card.wordId,
          storyId: card.storyId ?? null,
          suspended: false,
          createdAt: reviewedAt.toISOString(),
        };
        const pendingEnroll =
          cardId.startsWith("local:") && offline.accountId.value
            ? (await listOfflineMutations(offline.accountId.value)).find(
                (mutation) =>
                  mutation.operation === "languageWord.enroll" &&
                  mutation.payload.localReviewId === cardId &&
                  ["pending", "retry", "blocked", "syncing"].includes(
                    mutation.status,
                  ),
              )
            : undefined;
        const localData = {
          ...existingReview,
          intervalDays: next.intervalDays,
          easeFactor: next.easeFactor,
          repetitions: next.repetitions,
          nextReviewAt: nextReviewAt.toISOString(),
          lastReviewedAt: reviewedAt.toISOString(),
          lastGrade: Number(gradeValue),
          streak: calculateOfflineNextStreak(
            card.reviewState.streak ?? 0,
            Number(gradeValue),
          ),
          updatedAt: reviewedAt.toISOString(),
        };
        await offline.queue({
          entity: "languageReview",
          operation: "languageReview.grade",
          entityId: cardId,
          changedFields: ["reviewState"],
          payload: {
            cardId,
            grade: Number(gradeValue),
            reviewedAt: reviewedAt.toISOString(),
            requestId: payload.requestId,
          },
          localData,
          dependsOn: pendingEnroll ? [pendingEnroll.id] : undefined,
          baseVersion: pendingEnroll ? 1 : undefined,
          sequence: true,
        });
        offlineReviewDataById.set(cardId, localData);
        requestIdsByCard.delete(cardId);
        return {
          nextReviewAt: nextReviewAt.toISOString(),
          intervalDays: next.intervalDays,
          easeFactor: next.easeFactor,
          xpEarned: 0,
        };
      }
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
      await languageRuntime.applyServerProjection(result.data.projection);
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
    isGrading: computed(() => pendingGradeIds.value.size > 0),
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

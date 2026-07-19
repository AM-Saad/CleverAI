<template>
  <ReviewSessionCard
    :finished="finished"
    :xp="summaryXp"
    :reviewed-count="reviewedCount"
    :total="sessionTotal"
    :minutes="elapsedMinutes"
    :streak="streak"
    :accuracy="accuracy"
    :achievement="achievement"
    :progress-pct="progressPct"
    :loading="loading"
    :error="errorMsg"
    :has-card="Boolean(currentCard)"
    :card-key="currentCard?.cardId"
    :eyebrow="eyebrow"
    :question="qa.question"
    :answer="qa.answer"
    :revealed="revealed"
    :state="currentCard?.reviewState ?? null"
    :disabled="isGrading || finishing"
    empty-subtitle="Capture and enroll words, then come back when they're due."
    empty-action-label="Back to language"
    @close="goLanguageHome"
    @done="goLanguageHome"
    @retry="load"
    @reveal="revealed = true"
    @grade="onGrade"
  />
</template>

<script setup lang="ts">
import ReviewSessionCard from "~/features/review/components/ReviewSessionCard.vue";
import {
  gradeEnumFor,
  type GradeKey,
} from "~/composables/review/useSm2Preview";
import { triggerNotificationPromptAfterReview } from "~/composables/shared/useNotificationPrompt";
import type {
  LanguageQueueCard,
  LanguageSentence,
} from "@shared/utils/language.contract";

const {
  currentCard,
  totalCards,
  isLoading,
  fetchError,
  isGrading,
  hasPendingGrades,
  gradeError,
  fetchQueue,
  grade,
} = useLanguageReview();

const sessionSummary = useSessionSummary();
const toast = useToast();
const revealed = ref(false);
const reviewedCount = ref(0);
const correctCount = ref(0);
const sessionTotal = ref(0);
const finished = ref(false);
const startedAt = ref(Date.now());
const streak = ref(0);
const summaryXp = ref(0);
const achievement = ref<string | null>(null);
const finishing = ref(false);

const waitingForPendingGrades = computed(
  () => !currentCard.value && hasPendingGrades.value && !finished.value,
);
const loading = computed(
  () => isLoading.value || finishing.value || waitingForPendingGrades.value,
);
const errorMsg = computed(() => fetchError.value?.message || null);
const progressPct = computed(() =>
  sessionTotal.value === 0
    ? 0
    : Math.round((reviewedCount.value / sessionTotal.value) * 100),
);
const accuracy = computed(() =>
  reviewedCount.value === 0
    ? 0
    : Math.round((correctCount.value / reviewedCount.value) * 100),
);
const elapsedMinutes = computed(() =>
  Math.max(1, Math.round((Date.now() - startedAt.value) / 60000)),
);
const eyebrow = computed(() =>
  currentCard.value
    ? `LANGUAGE · ${currentCard.value.sourceLang.toUpperCase()}→${currentCard.value.translationLang.toUpperCase()}`
    : "LANGUAGE",
);
const qa = computed(() => extractLanguageQA(currentCard.value));

function primaryClozeSentence(
  card: LanguageQueueCard,
): LanguageSentence | null {
  const sentences = card.sentences;
  if (!sentences?.length) return null;

  const word = card.word.trim().toLowerCase();
  const matchingSentence = sentences.find((sentence) => {
    const clozeWord = sentence.clozeWord.trim().toLowerCase();
    return clozeWord === word || sentence.text.toLowerCase().includes(word);
  });

  return matchingSentence ?? sentences[0] ?? null;
}

function extractLanguageQA(card: LanguageQueueCard | null) {
  if (!card) return { question: "", answer: "" };

  const cloze = primaryClozeSentence(card);
  if (cloze) {
    return {
      question: cloze.clozeBlank,
      answer: `${cloze.text}\n${card.word} = ${card.translation}`,
    };
  }

  return {
    question: `What does "${card.word}" mean?`,
    answer: card.translation,
  };
}

async function onGrade(key: GradeKey) {
  const card = currentCard.value;
  if (!card || isGrading.value || finishing.value) return;

  const wasRevealed = revealed.value;
  const wasLastCard = reviewedCount.value + 1 >= sessionTotal.value;
  revealed.value = false;
  if (key !== "again") correctCount.value += 1;
  reviewedCount.value += 1;
  finishing.value = wasLastCard;
  try {
    const result = await grade(card.cardId, gradeEnumFor(key));
    if (!result) {
      reviewedCount.value = Math.max(0, reviewedCount.value - 1);
      if (key !== "again")
        correctCount.value = Math.max(0, correctCount.value - 1);
      if (currentCard.value?.cardId === card.cardId)
        revealed.value = wasRevealed;
      toast.add({
        title: "Grade not saved",
        description:
          gradeError.value?.message ?? "That word was returned to the queue.",
        color: "warning",
      });
      return;
    }

    if (
      reviewedCount.value >= sessionTotal.value &&
      !currentCard.value &&
      !hasPendingGrades.value
    ) {
      await endSession();
    }
  } finally {
    finishing.value = false;
  }
}

async function endSession() {
  await sessionSummary.endSession();
  summaryXp.value = sessionSummary.summary.value?.xpGained ?? 0;
  if (sessionSummary.summary.value?.leveledUp) {
    achievement.value = `Level ${sessionSummary.summary.value.levelAfter} reached`;
  } else if (sessionSummary.summary.value?.stageUnlocked) {
    achievement.value = `${sessionSummary.summary.value.stageAfter} unlocked`;
  }
  finished.value = true;
  triggerNotificationPromptAfterReview();
}

async function fetchStreak() {
  try {
    const res = await $fetch<{ data?: { currentStreak?: number } }>(
      "/api/review/analytics",
    );
    streak.value = res?.data?.currentStreak ?? 0;
  } catch {
    /* non-blocking */
  }
}

async function load() {
  startedAt.value = Date.now();
  reviewedCount.value = 0;
  correctCount.value = 0;
  summaryXp.value = 0;
  achievement.value = null;
  finished.value = false;
  finishing.value = false;
  revealed.value = false;
  const [, result] = await Promise.all([
    sessionSummary.startSession(),
    fetchQueue(),
  ]);
  sessionTotal.value = result?.cards.length ?? totalCards.value;
  void fetchStreak();
}

function goLanguageHome() {
  navigateTo("/language");
}

onMounted(load);
</script>

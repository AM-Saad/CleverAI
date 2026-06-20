<script setup lang="ts">
import StoryCard from "~/features/language-learning/components/StoryCard.vue";
import type { ReviewGrade } from "~/shared/utils/review.contract";

const {
  currentCard,
  currentIndex,
  totalCards,
  remainingCards,
  progress,
  isComplete,
  isLoading,
  fetchError,
  isGrading,
  gradeError,
  isSpeaking,
  fetchQueue,
  grade,
  nextCard,
  previousCard,
  speakWord,
} = useLanguageReview();

const lastXp = ref<number | null>(null);

const onGrade = async (value: ReviewGrade) => {
  if (!currentCard.value) return;
  const result = await grade(currentCard.value.cardId, value);
  if (result) lastXp.value = result.xpEarned;
};

const handleSpeak = (text?: string) => {
  if (!currentCard.value) return;
  void speakWord(text || currentCard.value.word, currentCard.value.sourceLang);
};

const onRefresh = () => void fetchQueue();

onMounted(() => fetchQueue());
</script>

<template>
  <review-kit-shell
    header-label="Language review"
    empty-message="Capture and enroll words, then come back when they're due."
    :loading="isLoading"
    :error="fetchError"
    :grade-error="gradeError"
    :is-complete="isComplete"
    :card-key="currentCard?.cardId ?? null"
    :index="currentIndex"
    :total="totalCards"
    :remaining="remainingCards"
    :progress="progress"
    :submitting="isGrading"
    :can-previous="currentIndex > 0"
    :xp-gained="lastXp"
    @grade="onGrade"
    @previous="previousCard"
    @skip="nextCard"
    @restart="onRefresh"
    @refresh="onRefresh"
  >
    <template #card="{ showAnswer }">
      <StoryCard
        v-if="currentCard"
        :card="currentCard"
        :show-answer="showAnswer"
        :is-speaking="isSpeaking"
        @speak="handleSpeak"
      />
    </template>

    <template #complete>
      <div
        class="flex h-16 w-16 items-center justify-center rounded-full bg-success/10"
      >
        <Icon name="i-lucide-check" class="h-8 w-8 text-success-text" />
      </div>
      <div class="space-y-1">
        <ui-subtitle size="xl" color="content-on-surface"
          >Session complete</ui-subtitle
        >
        <ui-paragraph size="sm" class="text-content-secondary">
          You reviewed {{ totalCards }} word{{ totalCards === 1 ? "" : "s" }}.
          Great work!
        </ui-paragraph>
      </div>
    </template>
  </review-kit-shell>
</template>

<template>
  <div class="flex flex-col h-full min-h-0">
    <!-- Loading -->
    <div v-if="isLoading" class="flex flex-col items-center justify-center flex-1 gap-4">
      <ui-loader :is-fetching="true" />
      <ui-paragraph size="sm" class="text-content-secondary">Loading your language cards...</ui-paragraph>
    </div>

    <!-- Fetch error -->
    <div v-else-if="fetchError" class="flex flex-col items-center justify-center flex-1 gap-4 p-6">
      <shared-error-message :error="fetchError" />
      <u-button @click="fetchQueue">Try again</u-button>
    </div>

    <!-- Session complete -->
    <div v-else-if="isComplete" class="flex flex-col items-center justify-center flex-1 gap-6 p-6 text-center">
      <div class="w-16 h-16 rounded-full bg-success/10 flex items-center justify-center">
        <Icon name="i-lucide-check-circle" class="w-8 h-8 text-success" />
      </div>
      <div class="space-y-1">
        <ui-subtitle size="xl" color="content-on-surface">Session Complete!</ui-subtitle>
        <ui-paragraph size="sm" class="text-content-secondary">
          You reviewed {{ totalCards }} word{{ totalCards === 1 ? '' : 's' }}. Great work!
        </ui-paragraph>
      </div>
      <div class="flex flex-col sm:flex-row gap-3">
        <u-button @click="handleRestart">
          <Icon name="i-lucide-refresh-cw" class="w-4 h-4 mr-1" />
          Review Again
        </u-button>
        <u-button variant="ghost" color="neutral" to="/language">
          <Icon name="i-lucide-arrow-left" class="w-4 h-4 mr-1" />
          Back to Overview
        </u-button>
      </div>
    </div>

    <!-- Active session -->
    <template v-else-if="currentCard">
      <!-- Progress bar + header -->
      <div class="shrink-0 px-4 pt-4 pb-2 space-y-3">
        <div class="flex items-center justify-between text-sm text-content-secondary">
          <span>{{ currentIndex + 1 }} / {{ totalCards }}</span>
          <span>{{ remainingCards }} remaining</span>
        </div>
        <div class="w-full h-1.5 rounded-[var(--radius-sm)] bg-surface-strong overflow-hidden">
          <div class="h-full bg-primary rounded-[var(--radius-sm)] transition-all duration-300"
            :style="{ width: `${progress}%` }" />
        </div>
      </div>

      <!-- Grade error -->
      <div v-if="gradeError" class="mx-4">
        <shared-error-message :error="gradeError" />
      </div>

      <!-- Card -->
      <div class="flex-1 flex items-start justify-center px-4 py-4 overflow-y-auto">
        <language-story-card :card="currentCard" :show-answer="showAnswer" :is-grading="isGrading"
          :is-speaking="isSpeaking" @reveal="showAnswer = true" @grade="handleGrade" @speak="speakWord" />
      </div>

      <!-- Bottom nav (go back) -->
      <div class="shrink-0 px-4 pb-4 flex items-center justify-between">
        <u-button variant="ghost" color="neutral" size="sm" :disabled="currentIndex === 0" @click="previousCard">
          <Icon name="i-lucide-arrow-left" class="w-4 h-4 mr-1" />
          Previous
        </u-button>
        <u-button variant="ghost" color="neutral" size="sm" :disabled="!showAnswer" @click="handleSkip">
          Skip
          <Icon name="i-lucide-arrow-right" class="w-4 h-4 ml-1" />
        </u-button>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
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

const showAnswer = ref(false);

const handleGrade = async (value: "0" | "1" | "2" | "3" | "4" | "5") => {
  if (!currentCard.value) return;
  await grade(currentCard.value.cardId, value);
  showAnswer.value = false;
};

const handleSkip = () => {
  nextCard();
  showAnswer.value = false;
};

const handleRestart = async () => {
  showAnswer.value = false;
  await fetchQueue();
};

// Watch card changes to reset answer state
watch(currentCard, () => {
  showAnswer.value = false;
});

onMounted(() => fetchQueue());
</script>

<template>
  <div>
    <review-kit-shell
      header-label="Review session"
      :loading="isLoading"
      :error="error"
      :is-complete="sessionComplete"
      :card-key="currentCard?.cardId ?? null"
      :index="currentCardIndex"
      :total="reviewQueue.length"
      :progress="progress"
      :submitting="isSubmitting"
      :can-previous="!isFirstCard"
      @grade="gradeCard"
      @previous="previousCard"
      @skip="skipCard"
      @restart="restartSession"
      @refresh="restartSession"
    >
      <template #stats>
        <review-stats
          :queue-stats="queueStats"
          @toggle-analytics="showAnalytics = !showAnalytics"
          @toggle-debug="showDebugPanel = !showDebugPanel"
        />
      </template>

      <template #card="{ showAnswer }">
        <review-card-display
          v-if="currentCard"
          :card="currentCard"
          :show-answer="showAnswer"
        />
      </template>

      <template #complete>
        <div
          class="flex h-16 w-16 items-center justify-center rounded-full bg-success/10"
        >
          <Icon name="i-lucide-party-popper" class="h-8 w-8 text-success" />
        </div>
        <div class="space-y-1">
          <ui-subtitle size="xl" color="content-on-surface"
            >Session complete</ui-subtitle
          >
          <ui-paragraph size="sm" class="text-content-secondary">
            Great work — you cleared your due cards.
          </ui-paragraph>
        </div>
        <div v-if="sessionSummary" class="w-full max-w-xs space-y-3">
          <div class="rounded-[var(--radius-lg)] bg-surface-subtle p-4">
            <div class="text-sm text-content-secondary">XP gained</div>
            <div class="text-3xl font-medium text-primary">
              +{{ sessionSummary.xpGained }}
            </div>
          </div>
          <div
            v-if="sessionSummary.leveledUp"
            class="rounded-[var(--radius-lg)] border border-warning/20 bg-warning/10 p-4"
          >
            <div class="font-medium text-warning">Level up</div>
            <div class="text-sm text-warning/80">
              Level {{ sessionSummary.levelBefore }} →
              {{ sessionSummary.levelAfter }}
            </div>
          </div>
          <div
            v-if="sessionSummary.stageUnlocked"
            class="rounded-[var(--radius-lg)] border border-primary/20 bg-primary/10 p-4"
          >
            <div class="font-medium text-primary">New stage unlocked</div>
            <div class="text-sm text-primary/80">
              {{ sessionSummary.stageAfter }}
            </div>
          </div>
        </div>
      </template>
    </review-kit-shell>

    <!-- Auxiliary overlays -->
    <ReviewAnalytics
      :show="showAnalytics"
      :workspace-id="workspaceId"
      @close="showAnalytics = false"
    />

    <dev-only>
      <div
        v-if="showDebugPanel"
        class="mt-4 rounded-[var(--radius-lg)] border border-warning/20 bg-warning/10 p-4 text-sm text-warning"
      >
        <div class="mb-2 flex items-center justify-between">
          <span class="font-medium">Debug</span>
          <UiButton
            size="xs"
            tone="warning"
            variant="ghost"
            @click="showDebugPanel = false"
            >Close</UiButton
          >
        </div>
        <div>Queue length: {{ reviewQueue.length }}</div>
        <div>Current index: {{ currentCardIndex }}</div>
        <div>Loading: {{ isLoading }}</div>
        <div v-if="currentCard">
          Card: {{ currentCard.cardId }} ({{ currentCard.resourceType }})
        </div>
      </div>
    </dev-only>
  </div>
</template>

<script setup lang="ts">
import ReviewAnalytics from "~/features/review/components/ReviewAnalytics.vue";
import ReviewStats from "~/features/review/components/ReviewStats.vue";
import ReviewCardDisplay from "~/features/review/components/CardDisplay.vue";
import type { ReviewGrade } from "~/shared/utils/review.contract";

interface Props {
  workspaceId?: string;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  refresh: [];
  cardGraded: [cardId: string, grade: ReviewGrade];
}>();

const {
  reviewQueue,
  currentCard,
  currentCardIndex,
  queueStats,
  isLoading,
  isSubmitting,
  error,
  isFirstCard,
  progress,
  grade,
  fetchQueue,
  nextCard: goToNextCardInQueue,
  previousCard: goToPreviousCardInQueue,
} = useCardReview();

const { incrementReviews, reset: resetSession } = useSessionTimer();
const { startSession, endSession, summary: sessionSummary } = useSessionSummary();

const showAnalytics = ref(false);
const showDebugPanel = ref(false);
const sessionComplete = ref(false);

const gradeCard = async (gradeValue: ReviewGrade) => {
  if (!currentCard.value) return;
  try {
    emit("cardGraded", currentCard.value.cardId, gradeValue);
    await grade(currentCard.value.cardId, gradeValue);
    incrementReviews();
    if (reviewQueue.value.length === 0) {
      await endSession();
      sessionComplete.value = true;
      emit("refresh");
    }
  } catch (err) {
    console.error("Failed to grade card:", err);
  }
};

const previousCard = () => goToPreviousCardInQueue();
const skipCard = () => goToNextCardInQueue();

const restartSession = async () => {
  sessionComplete.value = false;
  resetSession();
  startSession();
  await fetchQueue(props.workspaceId);
  emit("refresh");
};

watch(
  () => props.workspaceId,
  () => {
    sessionComplete.value = false;
    fetchQueue(props.workspaceId);
    resetSession();
    startSession();
  },
  { immediate: true },
);
</script>

<template>
  <ReviewSessionFrame
    :finished="finished"
    :xp="xp"
    :reviewed-count="reviewedCount"
    :total="total"
    :minutes="minutes"
    :streak="streak"
    :accuracy="accuracy"
    :achievement="achievement"
    :progress-pct="progressPct"
    :loading="loading"
    :error="error"
    :has-card="hasCard"
    :empty-title="emptyTitle"
    :empty-subtitle="emptySubtitle"
    :empty-action-label="emptyActionLabel"
    @close="emit('close')"
    @done="emit('done')"
    @retry="emit('retry')"
  >
    <div class="review-card-stage">
      <Transition name="review-card-swap" mode="out-in">
        <ReviewCardView
          v-if="hasCard"
          :key="cardKey"
          :eyebrow="eyebrow"
          :question="question"
          :answer="answer"
          :revealed="revealed"
          :swipe-enabled="swipeEnabled && !disabled"
          @reveal="emit('reveal')"
          @grade="emit('grade', $event)"
        />
      </Transition>
    </div>

    <template #footer>
      <Sm2GradeBar
        v-if="revealed && state"
        :state="state"
        :disabled="disabled"
        @grade="emit('grade', $event)"
      />
      <p v-else class="review-hint">{{ hint }}</p>
    </template>
  </ReviewSessionFrame>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted } from "vue";
import ReviewCardView from "~/features/review/components/ReviewCardView.vue";
import ReviewSessionFrame from "~/features/review/components/ReviewSessionFrame.vue";
import Sm2GradeBar from "~/features/review/components/Sm2GradeBar.vue";
import type { GradeKey, Sm2State } from "~/composables/review/useSm2Preview";

const props = withDefaults(
  defineProps<{
    finished: boolean;
    xp: number;
    reviewedCount: number;
    total: number;
    minutes: number;
    streak: number;
    accuracy: number;
    achievement?: string | null;
    progressPct: number;
    loading?: boolean;
    error?: string | null;
    hasCard: boolean;
    cardKey?: string | number;
    eyebrow: string;
    question: string;
    answer: string;
    revealed: boolean;
    state?: Sm2State | null;
    disabled?: boolean;
    swipeEnabled?: boolean;
    hint?: string;
    emptyTitle?: string;
    emptySubtitle?: string;
    emptyActionLabel?: string;
  }>(),
  {
    achievement: null,
    loading: false,
    error: null,
    state: null,
    disabled: false,
    swipeEnabled: true,
    hint: "Tap the card or press Space to reveal",
    emptyTitle: "All caught up",
    emptySubtitle: "No cards are due right now. Come back later.",
    emptyActionLabel: "Back to home",
  },
);

const emit = defineEmits<{
  close: [];
  done: [];
  retry: [];
  reveal: [];
  grade: [key: GradeKey];
}>();

const gradeKeyForShortcut: Record<string, GradeKey> = {
  "1": "again",
  "2": "hard",
  "3": "good",
  "4": "easy",
};

function onKeydown(event: KeyboardEvent) {
  if (
    event.defaultPrevented ||
    event.repeat ||
    props.finished ||
    props.loading ||
    props.error ||
    !props.hasCard ||
    props.disabled
  ) {
    return;
  }

  const target = event.target as HTMLElement | null;
  if (target?.closest("input, textarea, select, [contenteditable='true']")) {
    return;
  }

  if (!props.revealed && (event.key === " " || event.key === "Enter")) {
    if (target?.closest("button, a")) return;
    event.preventDefault();
    emit("reveal");
    return;
  }

  if (!props.revealed) return;
  const gradeKey = gradeKeyForShortcut[event.key];
  if (!gradeKey) return;
  event.preventDefault();
  emit("grade", gradeKey);
}

onMounted(() => window.addEventListener("keydown", onKeydown));
onBeforeUnmount(() => window.removeEventListener("keydown", onKeydown));
</script>

<style scoped>
.review-card-stage {
  width: 100%;
}

.review-card-swap-enter-active {
  transition:
    transform 260ms var(--ease-emphasized),
    opacity 180ms var(--ease-standard);
}

.review-card-swap-leave-active {
  transition:
    transform 210ms var(--ease-emphasized),
    opacity 150ms var(--ease-standard);
}

.review-card-swap-enter-from {
  opacity: 0;
  transform: translateY(22px) scale(0.985);
}

.review-card-swap-leave-to {
  opacity: 0;
  transform: translateY(-14px) scale(0.985);
}

.review-hint {
  text-align: center;
  font-size: 13px;
  color: var(--color-content-disabled);
}

@media (prefers-reduced-motion: reduce) {
  .review-card-swap-enter-active,
  .review-card-swap-leave-active {
    transition-duration: 0.01ms;
  }
}
</style>

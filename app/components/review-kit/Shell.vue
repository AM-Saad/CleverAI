<template>
  <div class="flex min-h-[28rem] flex-col">
    <!-- Loading -->
    <div
      v-if="loading"
      class="flex flex-1 flex-col items-center justify-center gap-3 py-12"
    >
      <ui-loader :is-fetching="true" />
      <ui-paragraph size="sm" class="text-content-secondary"
        >Loading your cards…</ui-paragraph
      >
    </div>

    <!-- Error -->
    <div
      v-else-if="error"
      class="flex flex-1 flex-col items-center justify-center gap-4 p-6"
    >
      <shared-error-message :error="error" />
      <UiButton tone="neutral" variant="outline" @click="emit('refresh')">
        <Icon name="i-lucide-refresh-cw" class="mr-1 h-4 w-4" />
        Try again
      </UiButton>
    </div>

    <!-- Session complete -->
    <div
      v-else-if="isComplete"
      class="flex flex-1 flex-col items-center justify-center gap-5 p-6 text-center"
    >
      <slot name="complete">
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
            You reviewed {{ total }} {{ total === 1 ? "card" : "cards" }}. Nice
            work.
          </ui-paragraph>
        </div>
      </slot>
      <UiButton @click="emit('restart')">
        <Icon name="i-lucide-refresh-cw" class="mr-1 h-4 w-4" />
        Review again
      </UiButton>
    </div>

    <!-- Empty -->
    <div
      v-else-if="!cardKey"
      class="flex flex-1 flex-col items-center justify-center gap-4 p-6 text-center"
    >
      <div
        class="inline-flex h-12 w-12 items-center justify-center rounded-[var(--radius-xl)] bg-surface-subtle"
      >
        <Icon name="i-lucide-inbox" class="h-6 w-6 text-content-secondary" />
      </div>
      <div class="space-y-1">
        <ui-subtitle size="lg" color="content-on-surface"
          >Nothing due right now</ui-subtitle
        >
        <ui-paragraph size="sm" class="text-content-secondary">{{
          emptyMessage
        }}</ui-paragraph>
      </div>
      <UiButton tone="neutral" variant="outline" @click="emit('refresh')">
        <Icon name="i-lucide-refresh-cw" class="mr-1 h-4 w-4" />
        Refresh
      </UiButton>
    </div>

    <!-- Active session -->
    <template v-else>
      <!-- Progress header -->
      <div class="shrink-0 space-y-2 pb-1">
        <div
          class="flex items-center justify-between text-sm text-content-secondary"
        >
          <span class="flex items-baseline gap-2">
            <span class="font-medium text-content-on-surface">{{
              headerLabel
            }}</span>
            <span>{{ headerCount }}</span>
          </span>
          <slot name="stats">
            <span>{{ resolvedRemaining }} remaining</span>
          </slot>
        </div>
        <div
          class="h-1.5 w-full overflow-hidden rounded-[var(--radius-sm)] bg-surface-strong"
        >
          <div
            class="h-full rounded-[var(--radius-sm)] bg-primary transition-[width] duration-[var(--duration-slow)] ease-[var(--ease-standard)]"
            :style="{ width: clampedProgress + '%' }"
          />
        </div>
      </div>

      <div v-if="gradeError" class="shrink-0 pt-1">
        <shared-error-message :error="gradeError" />
      </div>

      <!-- Card stage -->
      <div
        class="relative flex min-h-0 flex-1 items-start justify-center overflow-y-auto py-5"
      >
        <AnimatePresence mode="wait">
          <motion.div
            :key="cardKey"
            class="w-full"
            :initial="cardInitial"
            :animate="{ opacity: 1, x: 0 }"
            :exit="cardExit"
            :transition="cardTransition"
          >
            <slot name="card" :show-answer="showAnswer" />
          </motion.div>
        </AnimatePresence>

        <Transition name="rk-xp">
          <div
            v-if="xpFloat !== null"
            :key="xpFloatKey"
            class="pointer-events-none absolute left-1/2 top-3 -translate-x-1/2 text-sm font-medium"
            :class="xpToneClass"
          >
            +{{ xpFloat }} XP
          </div>
        </Transition>
      </div>

      <!-- Controls -->
      <div class="shrink-0 space-y-3 pt-1">
        <div v-if="!showAnswer" class="flex justify-center">
          <UiButton
            size="lg"
            class="px-8 transition-transform duration-[var(--duration-fast)] active:scale-[0.98]"
            aria-label="Show answer for this review card"
            @click="reveal"
          >
            <Icon name="i-lucide-eye" class="mr-1 h-4 w-4" />
            Show answer
          </UiButton>
        </div>
        <review-kit-grade-bar v-else :loading="submitting" @grade="onGrade" />

        <div class="flex items-center justify-center gap-3">
          <UiButton
            tone="neutral"
            variant="ghost"
            size="sm"
            :disabled="!canPrevious || submitting"
            @click="emit('previous')"
          >
            <Icon name="i-lucide-arrow-left" class="mr-1 h-4 w-4" />
            Previous
          </UiButton>
          <slot name="footer" />
          <UiButton
            tone="neutral"
            variant="ghost"
            size="sm"
            :disabled="submitting"
            @click="emit('skip')"
          >
            Skip
            <Icon name="i-lucide-arrow-right" class="ml-1 h-4 w-4" />
          </UiButton>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
/**
 * ReviewKitShell — the shared chrome for every review surface (normal SR +
 * language). Owns progress, loading/error/empty/complete states, the reveal +
 * grade controls, keyboard handling, and the card enter/exit motion (sentiment
 * based) + floating XP. Hosts supply only the domain card body via #card.
 */
import { AnimatePresence, motion } from "motion-v";
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { REVIEW_GRADES, gradeForKey, type ReviewGradeTone } from "./grades";
import type { ReviewGrade } from "~/shared/utils/review.contract";
import type { APIError } from "~/services/FetchFactory";

const props = withDefaults(
  defineProps<{
    loading?: boolean;
    error?: APIError | string | null;
    gradeError?: APIError | string | null;
    isComplete?: boolean;
    /** Identity of the current card. null/undefined => empty state. */
    cardKey?: string | number | null;
    index?: number;
    total?: number;
    remaining?: number | null;
    /** Explicit 0–100 progress; falls back to index/total. */
    progress?: number | null;
    submitting?: boolean;
    canPrevious?: boolean;
    headerLabel?: string;
    emptyMessage?: string;
    /** Set (to a positive number) to float a "+N XP" chip after a grade. */
    xpGained?: number | null;
    keyboard?: boolean;
  }>(),
  {
    loading: false,
    error: null,
    gradeError: null,
    isComplete: false,
    cardKey: null,
    index: 0,
    total: 0,
    remaining: null,
    progress: null,
    submitting: false,
    canPrevious: true,
    headerLabel: "Review session",
    emptyMessage: "Enroll cards and check back when they're due.",
    xpGained: null,
    keyboard: true,
  },
);

const emit = defineEmits<{
  reveal: [];
  grade: [value: ReviewGrade];
  previous: [];
  next: [];
  skip: [];
  restart: [];
  refresh: [];
}>();

const showAnswer = ref(false);
watch(
  () => props.cardKey,
  () => {
    showAnswer.value = false;
  },
);

const resolvedRemaining = computed(() =>
  props.remaining != null
    ? props.remaining
    : Math.max(0, props.total - props.index - 1),
);
const clampedProgress = computed(() => {
  const p =
    props.progress != null
      ? props.progress
      : props.total
        ? (props.index / props.total) * 100
        : 0;
  return Math.max(0, Math.min(100, Math.round(p)));
});
const headerCount = computed(
  () => `${Math.min(props.index + 1, props.total)} / ${props.total}`,
);

// ── Sentiment-based card exit ──────────────────────────────────────────────
const toneExit: Record<ReviewGradeTone, Record<string, number>> = {
  error: { opacity: 0, y: 64, rotate: 2 },
  warning: { opacity: 0, x: -80, rotate: -3 },
  info: { opacity: 0, x: 80, rotate: 3 },
  success: { opacity: 0, y: -68, rotate: -2 },
};
const exitVariant = ref<Record<string, number>>({ opacity: 0, x: -28 });
const lastTone = ref<ReviewGradeTone | null>(null);

// Respect the OS reduced-motion preference for motion-v. The global CSS reset in
// main.css only neutralizes CSS transitions/animations, not JS-driven motion, so
// the card spring/slide is gated here — reduced motion collapses to instant swaps.
const prefersReducedMotion = ref(false);
const cardInitial = computed(() =>
  prefersReducedMotion.value ? { opacity: 0 } : { opacity: 0, x: 28 },
);
const cardTransition = computed(() =>
  prefersReducedMotion.value
    ? ({ duration: 0 } as const)
    : ({ type: "spring", stiffness: 380, damping: 34 } as const),
);
const cardExit = computed(() =>
  prefersReducedMotion.value ? { opacity: 0 } : exitVariant.value,
);

function reveal() {
  if (showAnswer.value) return;
  showAnswer.value = true;
  emit("reveal");
}

function onGrade(value: ReviewGrade) {
  const option = REVIEW_GRADES.find((g) => g.value === value);
  lastTone.value = option?.tone ?? null;
  exitVariant.value = option ? toneExit[option.tone] : { opacity: 0, x: -28 };
  emit("grade", value);
}

// ── Floating XP ────────────────────────────────────────────────────────────
const xpFloat = ref<number | null>(null);
const xpFloatKey = ref(0);
let xpTimer: ReturnType<typeof setTimeout> | null = null;
watch(
  () => props.xpGained,
  (value) => {
    if (value == null || value <= 0) return;
    xpFloat.value = value;
    xpFloatKey.value += 1;
    if (xpTimer) clearTimeout(xpTimer);
    xpTimer = setTimeout(() => {
      xpFloat.value = null;
    }, 1000);
  },
);
const xpToneClass = computed(() => {
  switch (lastTone.value) {
    case "error":
      return "text-error-text";
    case "warning":
      return "text-warning-text";
    case "success":
      return "text-success-text";
    default:
      return "text-info-text";
  }
});

// ── Keyboard ───────────────────────────────────────────────────────────────
function onKey(event: KeyboardEvent) {
  if (!props.keyboard) return;
  if (props.loading || props.error || props.isComplete || !props.cardKey)
    return;
  const target = event.target as HTMLElement | null;
  if (
    target &&
    (target.tagName === "INPUT" ||
      target.tagName === "TEXTAREA" ||
      target.isContentEditable)
  )
    return;

  if (event.key === " " || event.key === "Enter") {
    if (!showAnswer.value) {
      event.preventDefault();
      reveal();
    }
    return;
  }
  if (event.key === "ArrowLeft") {
    if (props.canPrevious) emit("previous");
    return;
  }
  if (event.key === "ArrowRight" || event.key.toLowerCase() === "s") {
    emit("skip");
    return;
  }
  if (showAnswer.value) {
    const option = gradeForKey(event.key);
    if (option) {
      event.preventDefault();
      onGrade(option.value);
    }
  }
}
let motionMql: MediaQueryList | null = null;
const syncReducedMotion = () => {
  prefersReducedMotion.value = motionMql?.matches ?? false;
};
onMounted(() => {
  window.addEventListener("keydown", onKey);
  motionMql = window.matchMedia("(prefers-reduced-motion: reduce)");
  syncReducedMotion();
  motionMql.addEventListener("change", syncReducedMotion);
});
onBeforeUnmount(() => {
  window.removeEventListener("keydown", onKey);
  motionMql?.removeEventListener("change", syncReducedMotion);
  if (xpTimer) clearTimeout(xpTimer);
});
</script>

<style scoped>
.rk-xp-enter-active {
  animation: rk-xp 1s ease forwards;
}
@keyframes rk-xp {
  0% {
    opacity: 0;
    transform: translate(-50%, 6px) scale(0.9);
  }
  20% {
    opacity: 1;
  }
  100% {
    opacity: 0;
    transform: translate(-50%, -34px) scale(1);
  }
}
@media (prefers-reduced-motion: reduce) {
  .rk-xp-enter-active {
    animation: none;
  }
}
</style>

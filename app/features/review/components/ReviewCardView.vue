<template>
  <div
    class="rc"
    :style="outerStyle"
    @pointerdown="onDown"
    @pointermove="onMove"
    @pointerup="onUp"
    @pointercancel="onCancel"
  >
    <!-- swipe color trail -->
    <div class="rc__trail rc__trail--again" :style="{ opacity: trailLeft }">
      <span class="rc__trail-label">AGAIN</span>
    </div>
    <div class="rc__trail rc__trail--good" :style="{ opacity: trailRight }">
      <span class="rc__trail-label">GOOD</span>
    </div>
    <div
      class="rc__check"
      :style="{ opacity: Math.max(trailLeft, trailRight) }"
    >
      <UiIcon
        :name="dragX < 0 ? 'i-lucide-rotate-ccw' : 'i-lucide-check'"
        class="h-7 w-7"
      />
    </div>

    <div class="rc__flip" :class="{ 'rc__flip--revealed': revealed }">
      <div class="rc__inner">
        <!-- FRONT: question -->
        <button
          type="button"
          class="rc__face rc__front"
          @click="!revealed && emit('reveal')"
        >
          <!-- design-allow: full-card native tap target to reveal -->
          <span class="rc__eyebrow">{{ eyebrow }}</span>
          <p class="rc__question" dir="auto">{{ question }}</p>
          <span v-if="!revealed" class="rc__hint">Tap to reveal answer</span>
        </button>

        <!-- BACK: the module-03 reveal — white card, QUESTION (muted) → ANSWER -->
        <div class="rc__face rc__back">
          <span class="rc__back-q-label">QUESTION</span>
          <p class="rc__back-q" dir="auto">{{ question }}</p>
          <div class="rc__divider" />
          <span class="rc__back-a-label">ANSWER</span>
          <p class="rc__answer" dir="auto">{{ answer }}</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * ReviewCardView — the review card with two signature interactions (module 09):
 *  - 3D flip on reveal (Y axis, ~360ms emphasized easing).
 *  - Swipe-to-grade: drag tilts the card toward the thumb, a red→green trail
 *    follows the drag, release past threshold commits Again (left) / Good
 *    (right). Cancelable; springs back below threshold.
 * Both respect prefers-reduced-motion.
 */
import { ref, computed } from "vue";

const props = withDefaults(
  defineProps<{
    eyebrow: string;
    question: string;
    answer: string;
    revealed: boolean;
    /** Enable swipe grading (only meaningful once revealed). */
    swipeEnabled?: boolean;
  }>(),
  { swipeEnabled: true },
);

const emit = defineEmits<{
  (e: "reveal"): void;
  (e: "grade", key: "again" | "good"): void;
}>();

const THRESHOLD = 120;
const dragX = ref(0);
const dragging = ref(false);
const commitDirection = ref<-1 | 1 | null>(null);
let startX = 0;

const canSwipe = computed(() => props.revealed && props.swipeEnabled);

const rotation = computed(() => Math.max(-10, Math.min(10, dragX.value / 14)));
const outerStyle = computed(() =>
  dragging.value
    ? {
        transform: `translateX(${dragX.value}px) rotate(${rotation.value}deg)`,
        transition: "none",
      }
    : commitDirection.value
      ? {
          opacity: "0",
          transform: `translateX(calc(${commitDirection.value} * 120vw)) rotate(${commitDirection.value * 12}deg)`,
        }
      : { transform: "translateX(0) rotate(0deg)" },
);
const trailLeft = computed(() =>
  dragX.value < 0 ? Math.min(1, -dragX.value / THRESHOLD) : 0,
);
const trailRight = computed(() =>
  dragX.value > 0 ? Math.min(1, dragX.value / THRESHOLD) : 0,
);

function onDown(e: PointerEvent) {
  if (!canSwipe.value || commitDirection.value) return;
  dragging.value = true;
  startX = e.clientX;
  (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
}
function onMove(e: PointerEvent) {
  if (!dragging.value) return;
  dragX.value = e.clientX - startX;
}
function onUp() {
  if (!dragging.value) return;
  dragging.value = false;
  if (dragX.value <= -THRESHOLD) {
    commitDirection.value = -1;
    emit("grade", "again");
    return;
  }
  if (dragX.value >= THRESHOLD) {
    commitDirection.value = 1;
    emit("grade", "good");
    return;
  }
  dragX.value = 0;
}
function onCancel() {
  if (commitDirection.value) return;
  dragging.value = false;
  dragX.value = 0;
}
</script>

<style scoped>
.rc {
  position: relative;
  width: 100%;
  touch-action: pan-y;
  transition:
    transform var(--duration-normal) var(--ease-emphasized),
    opacity var(--duration-fast) var(--ease-standard);
}

/* Swipe trails */
.rc__trail {
  position: absolute;
  inset: 0;
  z-index: 2;
  border-radius: var(--component-card-radius);
  display: flex;
  align-items: flex-start;
  padding: var(--space-4);
  pointer-events: none;
}
.rc__trail--again {
  justify-content: flex-start;
  background: color-mix(in srgb, var(--color-error) 22%, transparent);
}
.rc__trail--good {
  justify-content: flex-end;
  background: color-mix(in srgb, var(--color-success) 22%, transparent);
}
.rc__trail-label {
  font-size: 13px;
  font-weight: 800;
  letter-spacing: 1.5px;
}
.rc__trail--again .rc__trail-label {
  color: var(--color-error-text);
}
.rc__trail--good .rc__trail-label {
  color: var(--color-success-text);
}
.rc__check {
  position: absolute;
  top: 50%;
  left: 50%;
  z-index: 3;
  transform: translate(-50%, -50%);
  display: grid;
  place-items: center;
  width: 52px;
  height: 52px;
  border-radius: var(--radius-full);
  background: var(--color-background);
  color: var(--color-primary);
  pointer-events: none;
}

/* 3D flip */
.rc__flip {
  perspective: 1100px;
}
.rc__inner {
  position: relative;
  transform-style: preserve-3d;
  transition: transform 360ms var(--ease-emphasized);
}
.rc__flip--revealed .rc__inner {
  transform: rotateY(180deg);
}
.rc__face {
  display: flex;
  flex-direction: column;
  width: 100%;
  border-radius: var(--component-card-radius);
  background: var(--color-background);
  border: 1px solid var(--color-secondary);
  padding: var(--space-6);
  backface-visibility: hidden;
  -webkit-backface-visibility: hidden;
}
.rc__front {
  align-items: center;
  justify-content: center;
  text-align: center;
  min-height: 340px;
  position: relative;
}
.rc__front .rc__eyebrow {
  position: absolute;
  top: 16px;
  left: 16px;
}
.rc__front .rc__hint {
  position: absolute;
  bottom: 20px;
  left: 50%;
  transform: translateX(-50%);
}
.rc__back {
  position: absolute;
  inset: 0;
  transform: rotateY(180deg);
  text-align: left;
  min-height: 340px;
  gap: var(--space-3);
  padding: 22px;
  overflow-y: auto;
}
.rc__eyebrow {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 2px;
  color: var(--color-content-secondary);
}
.rc__question {
  font-size: 25px;
  font-weight: 700;
  line-height: 1.25;
  letter-spacing: -0.3px;
  color: var(--color-content-on-surface-strong);
}
.rc__hint {
  margin-top: auto;
  padding: 8px 16px;
  border-radius: var(--radius-full);
  background: var(--color-surface-subtle);
  color: var(--color-content-secondary);
  font-size: 13px;
  font-weight: 600;
}
.rc__back-q-label {
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 1.5px;
  color: var(--color-content-secondary);
}
.rc__back-q {
  font-size: 18px;
  font-weight: 600;
  line-height: 1.25;
  color: var(--color-content-on-surface);
}
.rc__divider {
  height: 1px;
  background: var(--color-secondary);
}
.rc__back-a-label {
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 1.5px;
  color: var(--color-primary);
}
.rc__answer {
  font-size: 21px;
  font-weight: 700;
  line-height: 1.3;
  letter-spacing: -0.3px;
  color: var(--color-content-on-surface-strong);
  white-space: pre-line;
}

@media (prefers-reduced-motion: reduce) {
  .rc,
  .rc__inner {
    transition-duration: 0.01ms;
  }
}
</style>

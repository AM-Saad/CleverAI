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
      <UiIcon :name="dragX < 0 ? 'rotate-ccw' : 'check'" class="h-7 w-7" />
    </div>

    <div class="rc__flip" :class="{ 'rc__flip--revealed': revealed }">
      <div class="rc__inner">
        <!-- FRONT: question -->
        <div class="rc__face rc__front" :aria-hidden="revealed">
          <button
            type="button"
            class="rc__front-main"
            :tabindex="revealed ? -1 : 0"
            @click="!revealed && emit('reveal')"
          >
            <!-- design-allow: full-card native tap target to reveal -->
            <span class="rc__eyebrow">{{ eyebrow }}</span>
            <p class="rc__question" dir="auto" :lang="safeQuestionLang">
              {{ question }}
            </p>
            <span v-if="phonetic || partOfSpeech" class="rc__word-meta">
              <span v-if="phonetic">{{ phonetic }}</span>
              <span v-if="phonetic && partOfSpeech" aria-hidden="true">·</span>
              <span v-if="partOfSpeech">{{ partOfSpeech }}</span>
            </span>
            <p
              v-if="promptContext"
              class="rc__prompt-context"
              dir="auto"
              :lang="safeQuestionLang"
            >
              <span class="rc__prompt-context-label">Captured context</span>
              {{ promptContext }}
            </p>
            <span v-if="!revealed" class="rc__hint">Tap to reveal answer</span>
          </button>
          <UiIconButton
            v-if="audioEnabled && !audioOnReveal"
            class="rc__audio"
            icon="volume-2"
            :label="`Hear ${audioText || question}`"
            tone="primary"
            variant="soft"
            size="md"
            :loading="audioLoading"
            :disabled="audioLoading"
            :tabindex="revealed ? -1 : 0"
            @click.stop="emit('speak')"
          />
        </div>

        <!-- BACK: the module-03 reveal — white card, QUESTION (muted) → ANSWER -->
        <div class="rc__face rc__back" :aria-hidden="!revealed">
          <span class="rc__back-q-label">QUESTION</span>
          <p class="rc__back-q" dir="auto" :lang="safeQuestionLang">
            {{ question }}
          </p>
          <div class="rc__divider" />
          <span class="rc__back-a-label">ANSWER</span>
          <div class="rc__answer-row">
            <p
              class="rc__answer"
              dir="auto"
              :lang="safeAnswerLang"
              aria-live="polite"
            >
              {{ answer }}
            </p>
            <UiIconButton
              v-if="audioEnabled && audioOnReveal"
              class="rc__audio rc__audio--answer"
              icon="volume-2"
              :label="`Hear ${audioText || answer}`"
              tone="primary"
              variant="soft"
              size="md"
              :loading="audioLoading"
              :disabled="audioLoading"
              :tabindex="revealed ? 0 : -1"
              @click.stop="emit('speak')"
            />
          </div>
          <div v-if="translation" class="rc__support">
            <span class="rc__support-label">TRANSLATION</span>
            <p dir="auto" :lang="safeTranslationLang">{{ translation }}</p>
          </div>
          <div v-if="definition" class="rc__support">
            <span class="rc__support-label">DEFINITION</span>
            <p dir="auto" :lang="safeQuestionLang">{{ definition }}</p>
          </div>
          <div v-if="context" class="rc__support">
            <span class="rc__support-label">{{
              context.label.toUpperCase()
            }}</span>
            <p dir="auto" :lang="safeQuestionLang">{{ context.text }}</p>
            <p
              v-if="context.translation"
              class="rc__support-translation"
              dir="auto"
              :lang="safeTranslationLang"
            >
              {{ context.translation }}
            </p>
          </div>
          <div v-if="visibleStoryText" class="rc__support">
            <span class="rc__support-label">STORY</span>
            <p dir="auto" :lang="safeQuestionLang">{{ visibleStoryText }}</p>
          </div>
          <div v-if="sourceContext" class="rc__support rc__support--source">
            <span class="rc__support-label">CAPTURED CONTEXT</span>
            <p dir="auto" :lang="safeQuestionLang">{{ sourceContext }}</p>
          </div>
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
import type { ReviewCardSupportContext } from "~/features/review/types";

const props = withDefaults(
  defineProps<{
    eyebrow: string;
    question: string;
    answer: string;
    questionLang?: string;
    answerLang?: string;
    translationLang?: string;
    audioText?: string;
    audioEnabled?: boolean;
    audioOnReveal?: boolean;
    audioLoading?: boolean;
    phonetic?: string | null;
    partOfSpeech?: string | null;
    translation?: string | null;
    definition?: string | null;
    context?: ReviewCardSupportContext | null;
    promptContext?: string | null;
    sourceContext?: string | null;
    storyText?: string | null;
    revealed: boolean;
    /** Enable swipe grading (only meaningful once revealed). */
    swipeEnabled?: boolean;
  }>(),
  {
    swipeEnabled: true,
    questionLang: undefined,
    answerLang: undefined,
    translationLang: undefined,
    audioText: undefined,
    audioEnabled: false,
    audioOnReveal: false,
    audioLoading: false,
    phonetic: null,
    partOfSpeech: null,
    translation: null,
    definition: null,
    context: null,
    promptContext: null,
    sourceContext: null,
    storyText: null,
  },
);

const emit = defineEmits<{
  (e: "reveal"): void;
  (e: "speak"): void;
  (e: "grade", key: "again" | "good"): void;
}>();

const THRESHOLD = 120;
const dragX = ref(0);
const dragging = ref(false);
const commitDirection = ref<-1 | 1 | null>(null);
let startX = 0;

const canSwipe = computed(() => props.revealed && props.swipeEnabled);
const validLang = (value?: string) =>
  value && /^[a-z]{2,3}(?:-[a-z0-9]+)*$/i.test(value) ? value : undefined;
const safeQuestionLang = computed(() => validLang(props.questionLang));
const safeAnswerLang = computed(() => validLang(props.answerLang));
const safeTranslationLang = computed(() => validLang(props.translationLang));
const visibleStoryText = computed(() => {
  const story = props.storyText?.trim();
  if (!story || story === props.context?.text.trim()) return null;
  return story;
});

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
  padding: 0;
}
.rc__front-main {
  display: flex;
  min-height: 340px;
  width: 100%;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: var(--space-6);
  border: 0;
  border-radius: inherit;
  background: transparent;
  color: inherit;
  cursor: pointer;
  font: inherit;
  text-align: center;
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
.rc__audio {
  position: absolute;
  top: 12px;
  right: 12px;
  z-index: 2;
  display: grid;
  width: var(--target-compact);
  height: var(--target-compact);
  place-items: center;
  border: 0;
  border-radius: var(--radius-full);
  background: var(--color-primary-soft);
  color: var(--color-primary);
  cursor: pointer;
}
.rc__audio:disabled {
  cursor: wait;
  opacity: 0.6;
}
.rc__audio--answer {
  position: static;
  flex: 0 0 auto;
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
.rc__word-meta {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  margin-top: var(--space-3);
  color: var(--color-content-secondary);
  font-size: var(--text-sm);
}
.rc__prompt-context {
  max-width: 34rem;
  margin-top: var(--space-4);
  color: var(--color-content-secondary);
  font-size: 15px;
  font-weight: 500;
  line-height: 1.5;
}
.rc__prompt-context-label {
  display: block;
  margin-bottom: 4px;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 1.3px;
  text-transform: uppercase;
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
.rc__answer-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
}
.rc__support {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding-top: var(--space-2);
  border-top: 1px solid var(--color-secondary);
  color: var(--color-content-on-surface);
  font-size: 15px;
  line-height: 1.5;
}
.rc__support--source {
  color: var(--color-content-secondary);
}
.rc__support-label {
  color: var(--color-content-secondary);
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 1.3px;
}
.rc__support-translation {
  color: var(--color-content-secondary);
  font-size: var(--text-sm);
}

@media (prefers-reduced-motion: reduce) {
  .rc,
  .rc__inner {
    transition-duration: 0.01ms;
  }
}
</style>

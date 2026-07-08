<template>
  <span ref="rootRef" class="ui-animated-text" :style="rootStyle">
    <span class="sr-only">{{ text }}</span>

    <span ref="measureRef" class="ui-animated-text__measure" aria-hidden="true">
      <span
        v-for="(char, index) in measureChars"
        :key="`${index}:${char}`"
        class="ui-animated-text__measure-char"
        :class="{ 'ui-animated-text__space': isSpace(char) }"
      >
        {{ printableChar(char) }}
      </span>
    </span>

    <span class="ui-animated-text__visual" aria-hidden="true">
      <span
        v-if="isAnimating && outgoingText"
        :key="`out:${revision}`"
        class="ui-animated-text__layer ui-animated-text__layer--out"
      >
        <span
          v-for="(char, index) in outgoingChars"
          :key="`out:${revision}:${index}:${char}`"
          class="ui-animated-text__char"
          :class="{ 'ui-animated-text__space': isSpace(char) }"
          :style="charStyle(index)"
        >
          {{ printableChar(char) }}
        </span>
      </span>

      <span
        :key="`in:${revision}`"
        class="ui-animated-text__layer"
        :class="{ 'ui-animated-text__layer--in': isAnimating }"
      >
        <span
          v-for="(char, index) in activeChars"
          :key="`in:${revision}:${index}:${char}`"
          class="ui-animated-text__char"
          :class="{ 'ui-animated-text__space': isSpace(char) }"
          :style="charStyle(index)"
        >
          {{ printableChar(char) }}
        </span>
      </span>
    </span>
  </span>
</template>

<script setup lang="ts">
/**
 * UiAnimatedText - compact text identity transition.
 *
 * The component treats old/new labels as layered words instead of reflowing
 * each character slot. That keeps neighboring UI, like chevrons, moving with
 * one smooth label-width transition while the characters roll inside a clip.
 */
import { computed, nextTick, onBeforeUnmount, ref, watch } from "vue";

const props = withDefaults(
  defineProps<{
    text: string;
    direction?: 1 | -1;
    durationMs?: number;
    staggerMs?: number;
    maxStaggeredChars?: number;
  }>(),
  {
    direction: 1,
    durationMs: 180,
    staggerMs: 14,
    maxStaggeredChars: 12,
  },
);

function splitText(value: string): string[] {
  const SegmenterCtor = (Intl as any).Segmenter;
  if (typeof SegmenterCtor === "function") {
    const segmenter = new SegmenterCtor(undefined, { granularity: "grapheme" });
    return Array.from(segmenter.segment(value), (part: any) => part.segment);
  }
  return Array.from(value);
}

const rootRef = ref<HTMLElement | null>(null);
const measureRef = ref<HTMLElement | null>(null);
const activeText = ref(props.text);
const outgoingText = ref("");
const measuredText = ref(props.text);
const animatedWidth = ref<number | null>(null);
const widthDurationMs = ref(props.durationMs);
const isAnimating = ref(false);
const revision = ref(0);
let settleTimer: ReturnType<typeof setTimeout> | null = null;
let widthFrame: number | null = null;

const activeChars = computed(() => splitText(activeText.value));
const outgoingChars = computed(() => splitText(outgoingText.value));
const measureChars = computed(() => splitText(measuredText.value));

const rootStyle = computed(() => ({
  "--ui-animated-text-direction": String(props.direction),
  "--ui-animated-text-duration": `${props.durationMs}ms`,
  "--ui-animated-text-width-duration": `${widthDurationMs.value}ms`,
  ...(animatedWidth.value !== null
    ? { width: `${Math.ceil(animatedWidth.value)}px` }
    : {}),
}));

watch(
  () => props.text,
  (next) => {
    void transitionTo(next);
  },
);

onBeforeUnmount(() => {
  clearTransition();
});

async function transitionTo(next: string) {
  if (next === activeText.value) return;

  const previous = activeText.value;
  const previousLength = splitText(previous).length;
  const nextLength = splitText(next).length;
  const maxDelay =
    Math.min(Math.max(previousLength, nextLength) - 1, props.maxStaggeredChars) *
    props.staggerMs;
  const settleMs = props.durationMs + Math.max(0, maxDelay) + 80;
  const fromWidth = rootRef.value?.getBoundingClientRect().width ?? null;

  clearTransition();
  revision.value += 1;
  outgoingText.value = previous;
  activeText.value = next;
  measuredText.value = next;
  isAnimating.value = true;
  widthDurationMs.value = settleMs;

  if (fromWidth !== null) {
    animatedWidth.value = fromWidth;
    await nextTick();

    const toWidth = measureRef.value?.getBoundingClientRect().width ?? null;
    if (toWidth !== null && Math.abs(toWidth - fromWidth) > 1) {
      widthFrame = requestAnimationFrame(() => {
        animatedWidth.value = toWidth;
        widthFrame = null;
      });
    } else {
      animatedWidth.value = null;
    }
  }

  settleTimer = setTimeout(() => {
    isAnimating.value = false;
    outgoingText.value = "";
    animatedWidth.value = null;
    widthDurationMs.value = props.durationMs;
    settleTimer = null;
  }, settleMs);
}

function clearTransition() {
  if (settleTimer) {
    clearTimeout(settleTimer);
    settleTimer = null;
  }
  if (widthFrame !== null) {
    cancelAnimationFrame(widthFrame);
    widthFrame = null;
  }
}

function charStyle(index: number): Record<string, string> {
  return {
    "--ui-animated-text-delay": `${
      Math.min(index, props.maxStaggeredChars) * props.staggerMs
    }ms`,
  };
}

function isSpace(char: string): boolean {
  return /\s/.test(char);
}

function printableChar(char: string): string {
  return isSpace(char) ? "\u00A0" : char;
}
</script>

<style scoped>
.ui-animated-text {
  display: inline-block;
  max-width: 100%;
  min-width: 0;
  overflow: hidden;
  position: relative;
  transition: width var(--ui-animated-text-width-duration) var(--ease-standard);
  vertical-align: bottom;
  will-change: width;
}

.ui-animated-text__visual {
  display: inline-grid;
  max-width: 100%;
  min-width: 0;
  overflow: hidden;
  white-space: nowrap;
  line-height: inherit;
}

.ui-animated-text__layer {
  grid-area: 1 / 1;
  display: inline-flex;
  width: max-content;
  min-width: 0;
  line-height: inherit;
}

.ui-animated-text__char,
.ui-animated-text__measure-char {
  display: inline-block;
  line-height: inherit;
}

.ui-animated-text__char {
  will-change: opacity, transform;
}

.ui-animated-text__space {
  width: 0.35em;
}

.ui-animated-text__measure {
  position: absolute;
  top: 0;
  left: 0;
  display: inline-flex;
  width: max-content;
  pointer-events: none;
  visibility: hidden;
  white-space: nowrap;
}

.ui-animated-text__layer--in .ui-animated-text__char {
  animation: ui-animated-text-in var(--ui-animated-text-duration)
    var(--ease-emphasized) both;
  animation-delay: var(--ui-animated-text-delay);
}

.ui-animated-text__layer--out .ui-animated-text__char {
  animation: ui-animated-text-out var(--ui-animated-text-duration)
    var(--ease-standard) both;
  animation-delay: var(--ui-animated-text-delay);
}

@keyframes ui-animated-text-in {
  from {
    opacity: 0;
    transform: translateY(calc(var(--ui-animated-text-direction) * 0.62em));
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes ui-animated-text-out {
  from {
    opacity: 1;
    transform: translateY(0);
  }
  to {
    opacity: 0;
    transform: translateY(calc(var(--ui-animated-text-direction) * -0.62em));
  }
}

@media (prefers-reduced-motion: reduce) {
  .ui-animated-text {
    transition: none;
  }

  .ui-animated-text__layer--in .ui-animated-text__char,
  .ui-animated-text__layer--out .ui-animated-text__char {
    animation: none;
  }
}
</style>

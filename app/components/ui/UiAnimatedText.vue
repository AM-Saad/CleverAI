<template>
  <span class="ui-animated-text" :style="rootStyle">
    <span class="sr-only">{{ text }}</span>
    <span class="ui-animated-text__visual" aria-hidden="true">
      <span
        v-for="index in slotIndexes"
        :key="index"
        class="ui-animated-text__slot"
        :style="slotStyle(index)"
      >
        <Transition name="ui-animated-text-char">
          <span
            v-if="charAt(index)"
            :key="charKey(index)"
            class="ui-animated-text__char"
            :class="{ 'ui-animated-text__char--space': isSpace(charAt(index)) }"
          >
            {{ printableChar(charAt(index)) }}
          </span>
        </Transition>
      </span>
    </span>
  </span>
</template>

<script setup lang="ts">
/**
 * UiAnimatedText - per-character text swap for compact labels.
 *
 * Designed for micro-interactions where the identity is changing in place
 * (workspace switcher, counters, short status labels) without replacing the
 * whole word at once.
 */
import { computed, onBeforeUnmount, ref, watch } from "vue";

const props = withDefaults(
  defineProps<{
    text: string;
    direction?: 1 | -1;
    durationMs?: number;
    staggerMs?: number;
  }>(),
  {
    direction: 1,
    durationMs: 150,
    staggerMs: 12,
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

const chars = computed(() => splitText(props.text));
const visibleLength = ref(chars.value.length);
const revision = ref(0);
let shrinkTimer: ReturnType<typeof setTimeout> | null = null;

const slotIndexes = computed(() =>
  Array.from({ length: visibleLength.value }, (_, index) => index),
);

const rootStyle = computed(() => ({
  "--ui-animated-text-direction": String(props.direction),
  "--ui-animated-text-duration": `${props.durationMs}ms`,
}));

watch(
  () => props.text,
  (next, previous) => {
    const previousLength = splitText(previous ?? "").length;
    const nextLength = splitText(next).length;
    revision.value += 1;
    visibleLength.value = Math.max(previousLength, nextLength);

    if (shrinkTimer) clearTimeout(shrinkTimer);
    const settleMs =
      props.durationMs + Math.max(previousLength, nextLength) * props.staggerMs;
    shrinkTimer = setTimeout(() => {
      visibleLength.value = splitText(props.text).length;
      shrinkTimer = null;
    }, settleMs);
  },
);

onBeforeUnmount(() => {
  if (shrinkTimer) clearTimeout(shrinkTimer);
});

function charAt(index: number): string {
  return chars.value[index] ?? "";
}

function charKey(index: number): string {
  return `${revision.value}:${index}:${charAt(index)}`;
}

function slotStyle(index: number): Record<string, string> {
  return { "--ui-animated-text-delay": `${index * props.staggerMs}ms` };
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
  vertical-align: bottom;
}

.ui-animated-text__visual {
  display: inline-flex;
  max-width: 100%;
  min-width: 0;
  overflow: hidden;
  white-space: nowrap;
  line-height: inherit;
}

.ui-animated-text__slot {
  display: inline-grid;
  flex: 0 0 auto;
  line-height: inherit;
}

.ui-animated-text__char {
  grid-area: 1 / 1;
  display: inline-block;
  line-height: inherit;
  will-change: opacity, transform;
}

.ui-animated-text__char--space {
  width: 0.35em;
}

.ui-animated-text-char-enter-active,
.ui-animated-text-char-leave-active {
  transition:
    opacity var(--ui-animated-text-duration) var(--ease-standard),
    transform var(--ui-animated-text-duration) var(--ease-emphasized);
  transition-delay: var(--ui-animated-text-delay);
}

.ui-animated-text-char-enter-from {
  opacity: 0;
  transform: translateY(calc(var(--ui-animated-text-direction) * 0.7em));
}

.ui-animated-text-char-leave-to {
  opacity: 0;
  transform: translateY(calc(var(--ui-animated-text-direction) * -0.7em));
}

@media (prefers-reduced-motion: reduce) {
  .ui-animated-text-char-enter-active,
  .ui-animated-text-char-leave-active {
    transition: none;
  }
}
</style>

<template>
  <div class="flip-card" :style="{ '--flip-card-min-height': minHeight }">
    <button type="button" class="flip-card__rotor" :style="{ transform: wrapperTransform }" :aria-label="resolvedLabel"
      :aria-pressed="flipped" @click="flipped = !flipped">
      <span class="flip-card__face flip-card__face--front">
        <slot name="front" />
      </span>

      <span class="flip-card__face flip-card__face--back" :style="{ transform: backTransform }">
        <slot name="back" />
      </span>
    </button>
  </div>
</template>

<script setup lang="ts">
/**
 * FlipCard — restored from the original swap/flip card primitive. Keeps its
 * front/back slot API while adding keyboard semantics, controlled state, token
 * styling, and reduced-motion support.
 */
import { computed } from "vue";

const flipped = defineModel<boolean>({ default: false });
const props = withDefaults(
  defineProps<{
    rotate?: "x" | "y";
    minHeight?: string;
    label?: string;
  }>(),
  {
    rotate: "y",
    minHeight: "320px",
    label: "",
  },
);

const axis = computed(() => (props.rotate === "x" ? "X" : "Y"));
const wrapperTransform = computed(
  () => `rotate${axis.value}(${flipped.value ? 180 : 0}deg)`,
);
const backTransform = computed(() => `rotate${axis.value}(180deg)`);
const resolvedLabel = computed(
  () =>
    props.label ||
    (flipped.value ? "Show flashcard question" : "Show flashcard answer"),
);
</script>

<style scoped>
.flip-card {
  width: 100%;
  min-height: var(--flip-card-min-height);
  perspective: 1100px;
  display: flex
}

.flip-card__rotor {
  position: relative;
  display: block;
  width: 100%;
  min-height: var(--flip-card-min-height);
  cursor: pointer;
  color: inherit;
  outline: none;
  transform-style: preserve-3d;
  transition: transform 360ms var(--ease-emphasized);
}

.flip-card__rotor:focus-visible {
  outline: 2px solid var(--ds-focus-outline-color);
  outline-offset: 3px;
  border-radius: var(--component-card-radius);
}

.flip-card__face {
  position: absolute;
  inset: 0;
  display: flex;
  min-height: var(--flip-card-min-height);
  flex-direction: column;
  overflow-y: auto;
  border: 1px solid var(--color-secondary);
  border-radius: var(--component-card-radius);
  padding: var(--space-6);
  backface-visibility: hidden;
  -webkit-backface-visibility: hidden;
}

.flip-card__face--front {
  background: var(--color-surface-subtle);
}

.flip-card__face--back {
  background: var(--color-background);
}

@media (prefers-reduced-motion: reduce) {
  .flip-card__rotor {
    transition-duration: 0.01ms;
  }
}
</style>

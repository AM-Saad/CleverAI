<template>
  <component :is="tag" :class="ui">
    <slot />
  </component>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { tv } from "./variants";

interface Props {
  /**
   * HTML tag to render
   */
  tag?: "label" | "span" | "p" | "div";
  /**
   * Subtitle size variant
   */
  size?: "sm" | "base" | "lg";
  /**
   * Font weight
   */
  weight?: "medium" | "semibold";
  /**
   * Text color variant
   */
  color?: "content-on-surface";

  /**
   * Center alignment
   */
  center?: boolean;
}

const {
  tag = "span",
  size = "base",
  weight = "medium",
  color = "content-on-surface",
  center = false,
} = defineProps<Props>();

const label = tv({
  base: "ui-label m-0",
  variants: {
    size: {
      sm: "text-xs",
      base: "text-sm",
      lg: "text-base",
    },
    weight: {
      medium: "font-medium",
      semibold: "font-semibold",
    },
    color: {
      "content-on-surface": "text-content-on-surface",
    },
  },
});

const ui = computed(() =>
  label({ size, weight, color, class: center ? "text-center" : "" }),
);
</script>

<style scoped>
.ui-label {
  margin: 0;
  line-height: var(--leading-normal);
}
</style>

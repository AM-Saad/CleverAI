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
  weight?: "medium" | "semibold" | "bold";
  /**
   * Text color variant
   */
  color?:
    | "content-on-surface"
    | "content-secondary"
    | "content-disabled"
    | "primary";
  /**
   * Uppercase eyebrow/caption treatment (adds letter-spacing to match).
   */
  uppercase?: boolean;

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
  uppercase = false,
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
      bold: "font-bold",
    },
    color: {
      "content-on-surface": "text-content-on-surface",
      "content-secondary": "text-content-secondary",
      "content-disabled": "text-content-disabled",
      primary: "text-primary",
    },
    uppercase: {
      true: "uppercase tracking-wide",
      false: "",
    },
  },
});

const ui = computed(() =>
  label({
    size,
    weight,
    color,
    uppercase,
    class: center ? "text-center" : "",
  }),
);
</script>

<style scoped>
.ui-label {
  margin: 0;
  line-height: var(--leading-normal);
}
</style>

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
  weight?: "light" | "normal" | "medium" | "semibold" | "bold";
  /**
   * Text color variant
   */
  color?:
    | "primary"
    | "content-on-surface"
    | "content-on-surface-strong"
    | "content-on-background"
    | "content-secondary"
    | "white"
    | "danger"
    | "success"
    | "disabled";

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
      light: "font-light",
      normal: "font-normal",
      medium: "font-medium",
      semibold: "font-semibold",
      bold: "font-bold",
    },
    color: {
      primary: "text-primary",
      "content-on-surface": "text-content-on-surface",
      "content-on-surface-strong": "text-content-on-surface-strong",
      "content-on-background": "text-content-on-background",
      "content-secondary": "text-content-secondary",
      white: "text-white",
      danger: "text-error-text",
      success: "text-success-text",
      disabled: "text-content-disabled",
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
  line-height: var(--line-height-normal);
}
</style>

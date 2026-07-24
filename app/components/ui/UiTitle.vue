<template>
  <component :is="tag" :class="ui">
    <slot />
  </component>
</template>

<script setup lang="ts">
interface Props {
  /**
   * HTML tag to render
   */
  tag?: "h1" | "h2" | "h3" | "h4" | "h5" | "h6" | "div";
  /**
   * Title size variant
   */
  size?: "xs" | "sm" | "base" | "lg" | "xl" | "2xl" | "3xl" | "4xl" | "5xl";
  /**
   * Font weight
   */
  weight?: "medium" | "semibold" | "bold" | "extrabold";
  /**
   * Text color variant
   */
  color?:
    | "content-on-surface"
    | "content-on-surface-strong"
    | "content-on-background"
    | "white"
    | "error"
    | "warning";

  /**
   * Uppercase eyebrow/section-heading treatment (adds letter-spacing to match).
   */
  uppercase?: boolean;

  /**
   * Tight tracking for large hero numbers/words. Mutually exclusive with
   * `uppercase` — nothing needs both wide and tight tracking at once.
   */
  tight?: boolean;

  /**
   * Center alignment
   */
  center?: boolean;
}

import { computed } from "vue";
import { tv } from "./variants";

const {
  tag = "h2",
  size = "2xl",
  weight = "medium",
  color = "content-on-background",
  uppercase = false,
  tight = false,
  center = false,
} = defineProps<Props>();

const title = tv({
  base: "ui-title m-0 tracking-normal",
  variants: {
    size: {
      xs: "text-xs leading-tight",
      sm: "text-sm leading-tight",
      base: "text-base leading-tight",
      lg: "text-lg leading-tight",
      xl: "text-xl leading-tight",
      "2xl": "text-2xl leading-tight",
      "3xl": "text-3xl leading-tight",
      "4xl": "text-4xl leading-tight",
      "5xl": "text-5xl leading-tight",
    },
    weight: {
      medium: "font-medium",
      semibold: "font-semibold",
      bold: "font-bold",
      extrabold: "font-extrabold",
    },
    color: {
      "content-on-surface": "text-content-on-surface",
      "content-on-surface-strong": "text-content-on-surface-strong",
      "content-on-background": "text-content-on-background",
      white: "text-white",
      error: "text-error-text",
      warning: "text-warning-text",
    },
    uppercase: {
      true: "uppercase tracking-wide",
      false: "",
    },
    tight: {
      true: "tracking-tight",
      false: "",
    },
  },
});

const ui = computed(() =>
  title({
    size,
    weight,
    color,
    uppercase,
    tight,
    class: center ? "text-center" : "",
  }),
);
</script>

<style scoped>
.ui-title {
  margin: 0;
  line-height: var(--leading-tight);
}
</style>

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
  tag?: "h2" | "h3" | "h4" | "h5" | "h6" | "div" | "span";
  /**
   * Subtitle size variant
   */
  size?: "sm" | "base" | "lg" | "xl" | "2xl";
  /**
   * Font weight
   */
  weight?: "medium" | "semibold" | "bold";
  /**
   * Text color variant
   */
  color?:
    | "content-on-surface"
    | "content-on-surface-strong"
    | "content-on-background"
    | "error";
  /**
   * Center alignment
   */
  center?: boolean;
}

const {
  tag = "h3",
  size = "lg",
  weight = "medium",
  color = "content-on-surface",
  center = false,
} = defineProps<Props>();

const subtitle = tv({
  base: "ui-subtitle m-0 tracking-normal",
  variants: {
    size: {
      sm: "text-sm leading-snug",
      base: "text-base leading-snug",
      lg: "text-base md:text-lg leading-snug",
      xl: "text-xl leading-snug",
      "2xl": "text-2xl leading-snug",
    },
    weight: {
      medium: "font-medium",
      semibold: "font-semibold",
      bold: "font-bold",
    },
    color: {
      "content-on-surface": "text-content-on-surface",
      "content-on-surface-strong": "text-content-on-surface-strong",
      "content-on-background": "text-content-on-background",
      error: "text-error-text",
    },
  },
});

const ui = computed(() =>
  subtitle({ size, weight, color, class: center ? "text-center" : "" }),
);
</script>

<style scoped>
.ui-subtitle {
  margin: 0;
  line-height: var(--leading-normal);
}
</style>

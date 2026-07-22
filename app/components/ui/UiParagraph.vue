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
  tag?: "p" | "span" | "div" | "li";
  /**
   * Text size variant
   */
  size?: "xs" | "sm" | "base" | "lg";
  /**
   * Text color variant
   */
  color?:
    | "primary"
    | "content-on-surface"
    | "content-on-background"
    | "content-secondary"
    | "disabled"
    | "error"
    | "success";
  /**
   * Font weight
   */
  weight?: "normal";
  /**
   * Center alignment
   */
  center?: boolean;
  /**
   * Additional CSS classes
   */
  className?: string;
}

const {
  tag = "p",
  size = "sm",
  color = "content-on-surface",
  weight = "normal",
  center = false,
  className = "",
} = defineProps<Props>();

const paragraph = tv({
  base: "ui-paragraph",
  variants: {
    size: {
      xs: "text-xs leading-normal",
      sm: "text-sm leading-relaxed",
      base: "text-base leading-relaxed",
      lg: "text-lg leading-relaxed",
    },
    weight: {
      normal: "font-normal",
    },
    color: {
      primary: "text-primary",
      "content-on-surface": "text-content-on-surface",
      "content-on-background": "text-content-on-background",
      "content-secondary": "text-content-secondary",
      error: "text-error-text",
      disabled: "text-content-disabled",
      success: "text-success-text",
    },
  },
});

const ui = computed(() =>
  paragraph({
    size,
    weight,
    color,
    class: [center ? "text-center" : "", className],
  }),
);
</script>

<style scoped>
.ui-paragraph {
  line-height: var(--leading-normal);
}
</style>

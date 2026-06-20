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
    | "content-on-surface-strong"
    | "content-on-background"
    | "content-secondary"
    | "disabled"
    | "white"
    | "danger"
    | "success";
  /**
   * Font weight
   */
  weight?: "light" | "normal" | "medium" | "semibold" | "bold";
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
  line-height: var(--line-height-normal);
}
</style>

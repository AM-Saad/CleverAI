<template>
  <component :is="tag" :class="[
    'ui-label',
    sizeClasses[size],
    weightClasses[weight],
    colorClasses[color],
    center ? 'text-center' : '',
  ]">
    <slot />
  </component>
</template>

<script setup lang="ts">
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
  color?: "primary" | "content-on-surface" | "content-on-surface-strong" | "content-on-background" | "content-secondary" | "white" | "danger" | "success" | "disabled";

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

const sizeClasses = {
  sm: "text-xs",
  base: "text-sm",
  lg: "text-base",
};

const weightClasses = {
  light: "font-light",
  normal: "font-normal",
  medium: "font-medium",
  semibold: "font-semibold",
  bold: "font-bold",
};
const colorClasses = {
  primary: "text-[color:var(--color-primary)]",
  "content-on-surface": "text-content-on-surface",
  "content-on-surface-strong": "text-content-on-surface-strong",
  "content-on-background": "text-content-on-background",
  "content-secondary": "text-content-secondary",
  white: "text-white",
  danger: "text-[color:var(--color-error)]",
  success: "text-success",
  disabled: "text-[color:var(--color-content-disabled)]",
};
</script>

<style scoped>
.ui-label {
  margin: 0;
  line-height: var(--line-height-normal);
}
</style>

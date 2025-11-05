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
  tag?: "h2" | "h3" | "h4" | "h5" | "h6" | "div" | "span";
  /**
   * Subtitle size variant
   */
  size?:  "sm" | "base" | "lg";
  /**
   * Font weight
   */
  weight?: "light" | "normal" | "medium" | "semibold" | "bold";
  /**
   * Text color variant
   */
  color?: "muted" | "neutral";
  /**
   * Center alignment
   */
  center?: boolean;
}

const {
  tag = "p",
  size = "base",
  weight = "medium",
  color = "muted",
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
  neutral: "text-[color:var(--color-neutral)]",
  muted: "text-[color:var(--color-muted)] dark:text-[color:var(--color-neutral)]",
};
</script>

<style scoped>
.ui-label {
  margin: 0;
  line-height: var(--line-height-normal);
}
</style>

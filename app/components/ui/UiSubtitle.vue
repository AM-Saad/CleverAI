<template>
  <component :is="tag" :class="[
    'ui-subtitle',
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
  size?: "xs" | "sm" | "base" | "lg" | "xl" | "2xl";
  /**
   * Font weight
   */
  weight?: "light" | "normal" | "medium" | "semibold" | "bold";
  /**
   * Text color variant
   */
  color?: "primary" | "content-on-surface" | "content-on-surface-strong" | "content-on-background" | "white" | "danger" | 'success' | 'disabled';
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

const sizeClasses = {
  xs: "text-xs leading-snug",
  sm: "text-sm leading-snug",
  base: "text-base leading-snug",
  lg: "text-base md:text-lg leading-snug",
  xl: "text-xl leading-snug",
  "2xl": "text-2xl leading-snug tracking-tight",
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
  white: "text-white",
  danger: "text-[color:var(--color-error)]",
  success: "text-success",
  disabled: "text-[color:var(--color-content-disabled)]",
};
</script>

<style scoped>
.ui-subtitle {
  margin: 0;
  line-height: var(--line-height-normal);
}
</style>

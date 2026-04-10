<template>
  <component :is="tag" :class="[
    'ui-title',
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
  tag?: "h1" | "h2" | "h3" | "h4" | "h5" | "h6" | "div";
  /**
   * Title size variant
   */
  size?: "xs" | "sm" | "base" | "lg" | "xl" | "2xl" | "3xl" | "4xl" | "5xl";
  /**
   * Font weight
   */
  weight?: "light" | "normal" | "medium" | "semibold" | "bold";
  /**
   * Text color variant
   */
  color?: "primary" | "content-on-surface" | "content-on-surface-strong" | "content-on-background" | "white" | "danger" | "success" | "disabled";

  /**
   * Center alignment
   */
  center?: boolean;
}

const {
  tag = "h2",
  size = "2xl",
  weight = "semibold",
  color = "content-on-background",
  center = false,
} = defineProps<Props>();

const sizeClasses = {
  xs: "text-xs leading-tight",
  sm: "text-sm leading-tight",
  base: "text-base leading-tight",
  lg: "text-lg leading-tight",
  xl: "text-xl leading-tight",
  "2xl": "text-2xl leading-tight tracking-tight",
  "3xl": "text-3xl leading-tight tracking-tight",
  "4xl": "text-4xl leading-tight tracking-tighter",
  "5xl": "text-5xl leading-tight tracking-tighter",
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
.ui-title {
  margin: 0;
  line-height: var(--line-height-tight);
}
</style>

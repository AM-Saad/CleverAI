<template>
  <component :is="tag" :class="[
    'ui-paragraph',
    sizeClasses[size],
    weightClasses[weight],

    colorClasses[color],
    center ? 'text-center' : '',
    className,
  ]">
    <slot />
  </component>
</template>

<script setup lang="ts">
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
  color?: "primary" | "content-on-surface" | 'content-on-surface-strong' | "content-on-background" | 'disabled' | "white" | "danger" | "success";
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

const sizeClasses = {
  xs: "text-xs",
  sm: "text-xs md:text-sm text-nowrap",
  base: "text-base",
  lg: "text-lg",
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
.ui-paragraph {
  line-height: var(--line-height-normal);
}
</style>

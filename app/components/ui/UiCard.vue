<template>
  <component
    :is="tag"
    :class="[
      'ui-card',
      className,
      variantClasses[variant],
      sizeClasses[size],
      shadowClasses[shadow],
      hoverClasses[hover],
    ]"
  >
    <div
      v-if="$slots.header"
      class="flex items-center justify-between border-b border-primary-light py-3 mb-4"
    >
      <slot name="header" />
    </div>

    <div v-if="$slots.default" :class="combinedContentClasses">
      <slot />
    </div>

    <div v-if="$slots.footer" class="ui-card__footer">
      <slot name="footer" />
    </div>
  </component>
</template>

<script setup lang="ts">
interface Props {
  /**
   * HTML tag to render
   */
  tag?: "div" | "article" | "section";
  /**
   * Card visual variant
   */
  variant?: "default" | "outline" | "ghost" | "elevated";
  /**
   * Card size (affects padding)
   */
  size?: "sm" | "md" | "lg" | "xl";
  /**
   * Shadow intensity
   */
  shadow?: "none" | "sm" | "md" | "lg" | "xl";
  /**
   * Hover effect
   */
  hover?: "none" | "lift" | "glow" | "scale";
  /**
   * Additional CSS classes
   */
  className?: string;
}

const {
  tag = "div",
  variant = "outline",
  size = "md",
  shadow = "none",
  hover = "none",
  className = "",
} = defineProps<Props>();

const variantClasses = {
  default:
    "bg-[color:var(--color-surface)] border border-[color:var(--color-surface-alt)]",
  outline: "bg-transparent border border-gray-300 dark:border-muted ",
  ghost: "border-0",
  elevated: "bg-[color:var(--color-surface-elevated)] border-0",
};

const sizeClasses = {
  sm: "p-2",
  md: "p-3",
  lg: "p-5",
  xl: "p-7",
};

const shadowClasses = {
  none: "shadow-none",
  sm: "shadow-sm",
  md: "shadow-md",
  lg: "shadow-lg",
  xl: "shadow-xl",
};

const hoverClasses = {
  none: "",
  lift: "hover:shadow-lg hover:-translate-y-1",
  glow: "hover:shadow-lg hover:shadow-[color:var(--color-primary)]/20",
  scale: "hover:scale-[1.02]",
};

const combinedContentClasses = ["ui-card__content"];
</script>

<style scoped>
.ui-card {
  border-radius: var(--radius-xl);
  transition: all 0.2s ease-in-out;
  display: flex;
  flex-direction: column;
}

.ui-card__header {
  padding-bottom: var(--spacing-md);
  border-bottom: 1px solid var(--color-surface-alt);
  margin-bottom: var(--spacing-md);
}

.ui-card__content {
  flex: 1;
}

.ui-card__footer {
  padding-top: var(--spacing-md);
  border-top: 1px solid var(--color-surface-alt);
  margin-top: var(--spacing-md);
}

/* Remove header/footer borders when they're the only content */
.ui-card__header:last-child {
  border-bottom: none;
  margin-bottom: 0;
  padding-bottom: 0;
}

.ui-card__footer:first-child {
  border-top: none;
  margin-top: 0;
  padding-top: 0;
}
</style>

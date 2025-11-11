<template>
  <component :is="tag" :class="[
    'ui-card',
    variantClasses[variant],
    sizeClasses[size],
    shadowClasses[shadow],
    hoverClasses[hover],
    className,
  ]">
    <div v-if="$slots.header"
      :class="['flex items-center justify-between text-dark dark:text-light', headerSizesClasses[size], headerStyle[variant]]">
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
  tag?: "div" | "article" | "section" | 'li';
  /**
   * Card visual variant
   */
  variant?: "default" | "outline" | "ghost";
  /**
   * Card size (affects padding)
   */
  size?: 'xs' | "sm" | "md" | "lg" | "xl";
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
  contentClasses?: string;
}

const {
  tag = "div",
  variant = "outline",
  size = "md",
  shadow = "none",
  hover = "none",
  className = "",
  contentClasses = "",
} = defineProps<Props>();

const variantClasses = {
  default:
    "bg-[color:var(--color-white)] border border-[color:var(--color-neutral)] dark:bg-[color:var(--color-muted)]/40 dark:border-[color:var(--color-dark)] ",
  outline: "bg-transparent border border-neutral dark:border-muted",
  ghost: "border-0",
};

const sizeClasses = {
  xs: "p-1",
  sm: "p-3",
  md: "p-4",
  lg: "p-4",
  xl: "p-5",
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
const headerSizesClasses = {
  xs: "pb-0.5 mb-1",
  sm: "pb-1.5 mb-4 text-sm font-medium",
  md: "pb-2.5 mb-5 text-base",
  lg: "pb-3 mb-7 text-lg font-medium",
  xl: "pb-3.5 mb-7 text-lg font-semibold",
};
const headerStyle = {
  default: "bg-white dark:bg-transparent border-b border-neutral dark:border-muted",
  outline: "border-b border-neutral dark:border-muted",
  ghost: "border-0",
  elevated: "border-b border-primary-light",
}

const combinedContentClasses = ["ui-card__content", contentClasses].join(" ");
</script>

<style scoped>
.ui-card {
  border-radius: var(--radius-xl);
  transition: all 0.2s ease-in-out;
  display: flex;
  flex-direction: column;
}


.ui-card__content {
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
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

<template>
  <component :is="tag" :class="[
    'ui-card overflow-auto',
    variantClasses[variant],
    shadowClasses[shadow],
    hoverClasses[hover],
    className,
  ]">
    <div v-if="$slots.header" :class="['flex items-center justify-between text-on-surface', headerSizesClasses[size], headerStyle[variant],
      sizeClasses[size],
    ]">
      <slot name="header" />
    </div>

    <div v-if="$slots.default" :class="[combinedContentClasses,
      sizeClasses[size],

    ]">
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
    "bg-surface border border-secondary ",
  outline: "bg-transparent border border-secondary",
  ghost: "border-0",
};

const sizeClasses = {
  xs: "p-1",
  sm: "p-2",
  md: "p-3",
  lg: "p-3 lg:p-4",
  xl: "p-5",
};

const shadowClasses = {
  none: "shadow-none!",
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
  xs: "mb-1",
  sm: "text-sm font-medium",
  md: "text-base font-medium",
  lg: "text-lg font-medium text-nowrap",
  xl: "text-lg font-medium",
};
const headerStyle = {
  default: "dark:bg-transparent border-b border-secondary ",
  outline: "border-b border-secondary ",
  ghost: "border-0",
  elevated: "border-b border-primary-light",
}

const combinedContentClasses = ["ui-card__content bg-background", contentClasses].join(" ");
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

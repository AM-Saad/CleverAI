<template>
  <component :is="tag" :class="[
    'ui-card',
    variantClasses[variant],
    shadowClasses[shadow],
    hoverClasses[hover],
    className,
  ]">
    <div v-if="$slots.header" :class="['flex items-center justify-between text-content-on-surface', headerSizesClasses[size], headerStyle[variant],
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
  variant?: "default" | "outline" | "ghost" | "surface" | "surface-strong";
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
    "bg-surface border border-surface-strong ",

  outline: "bg-transparent border border-secondary",
  ghost: "border-0",
  surface: "bg-surface-subtle border border-surface-strong",
  "surface-strong": "bg-surface-strong border border-surface-strong",
};

const sizeClasses = {
  xs: "p-[var(--component-card-padding-xs)]",
  sm: "p-[var(--component-card-padding-sm)]",
  md: "p-[var(--component-card-padding-md)]",
  lg: "p-[var(--component-card-padding-md)] lg:p-[var(--component-card-padding-lg)]",
  xl: "p-[var(--component-card-padding-xl)]",
};

const shadowClasses = {
  none: "shadow-none!",
  sm: "shadow-[var(--shadow-dropdown)]",
  md: "shadow-[var(--shadow-dropdown)]",
  lg: "shadow-[var(--shadow-card-hover)]",
  xl: "shadow-[var(--shadow-modal)]",
};

const hoverClasses = {
  none: "",
  lift: "hover:shadow-[var(--shadow-card-hover)] hover:-translate-y-1",
  glow: "hover:shadow-[var(--shadow-primary-glow)]",
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
  surface: "border-b border-surface-strong",
  ghost: "border-0",
  "surface-strong": "border-b border-surface-strong",
}

const combinedContentClasses = ["ui-card__content", contentClasses].join(" ");
</script>

<style scoped>
.ui-card {
  border-radius: var(--component-card-radius);
  transition: all 0.2s ease-in-out;
  display: flex;
  flex-direction: column;
}


.ui-card__content {
  display: flex;
  flex-direction: column;
  flex: 1 1 auto;
  min-height: 0;
  overflow: hidden;
}

.ui-card__footer {
  padding-top: var(--spacing-md);
  border-top: 1px solid var(--color-secondary);
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

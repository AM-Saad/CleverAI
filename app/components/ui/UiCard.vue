<template>
  <component :is="tag" :class="ui.root({ class: className })">
    <div v-if="$slots.header" :class="ui.header()">
      <slot name="header" />
    </div>

    <div v-if="$slots.default" :class="ui.content({ class: contentClasses })">
      <slot />
    </div>

    <div v-if="$slots.footer" :class="ui.footer()">
      <slot name="footer" />
    </div>
  </component>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { tv } from "./variants";

interface Props {
  /** HTML tag to render */
  tag?: "div" | "article" | "section" | "li";
  /** Card visual variant */
  variant?: "default" | "outline" | "ghost" | "surface" | "surface-strong";
  /** Card size (affects padding) */
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  /** Shadow intensity */
  shadow?: "none" | "sm" | "md" | "lg" | "xl";
  /** Hover effect */
  hover?: "none" | "lift" | "glow" | "scale";
  /** Extra classes merged onto the root */
  className?: string;
  /** Extra classes merged onto the content area */
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

// Reference variant implementation for all Ui* primitives: declare classes with
// tv() slots instead of hand-rolled computed maps. All values are design tokens.
const card = tv({
  slots: {
    root: "ui-card",
    header: "flex items-center justify-between text-content-on-surface",
    content: "ui-card__content",
    footer: "ui-card__footer",
  },
  variants: {
    variant: {
      default: { root: "bg-surface border border-surface-strong", header: "dark:bg-transparent border-b border-secondary" },
      outline: { root: "bg-transparent border border-secondary", header: "border-b border-secondary" },
      ghost: { root: "border-0", header: "border-0" },
      surface: { root: "bg-surface-subtle border border-surface-strong", header: "border-b border-surface-strong" },
      "surface-strong": { root: "bg-surface-strong border border-surface-strong", header: "border-b border-surface-strong" },
    },
    size: {
      xs: { header: "mb-1 p-[var(--component-card-padding-xs)]", content: "p-[var(--component-card-padding-xs)]" },
      sm: { header: "text-sm font-medium p-[var(--component-card-padding-sm)]", content: "p-[var(--component-card-padding-sm)]" },
      md: { header: "text-base font-medium p-[var(--component-card-padding-md)]", content: "p-[var(--component-card-padding-md)]" },
      lg: { header: "text-lg font-medium text-nowrap p-[var(--component-card-padding-md)] lg:p-[var(--component-card-padding-lg)]", content: "p-[var(--component-card-padding-md)] lg:p-[var(--component-card-padding-lg)]" },
      xl: { header: "text-lg font-medium p-[var(--component-card-padding-xl)]", content: "p-[var(--component-card-padding-xl)]" },
    },
    shadow: {
      none: { root: "shadow-none!" },
      sm: { root: "shadow-[var(--shadow-dropdown)]" },
      md: { root: "shadow-[var(--shadow-dropdown)]" },
      lg: { root: "shadow-[var(--shadow-card-hover)]" },
      xl: { root: "shadow-[var(--shadow-modal)]" },
    },
    hover: {
      none: {},
      lift: { root: "hover:shadow-[var(--shadow-card-hover)] hover:-translate-y-1" },
      glow: { root: "hover:shadow-[var(--shadow-primary-glow)]" },
      scale: { root: "hover:scale-[1.02]" },
    },
  },
});

const ui = computed(() => card({ variant, size, shadow, hover }));
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
  padding-top: var(--space-4);
  border-top: 1px solid var(--color-secondary);
  margin-top: var(--space-4);
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

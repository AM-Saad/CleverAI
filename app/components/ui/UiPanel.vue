<template>
  <component :is="tag" :class="ui.root({ class: className })">
    <div v-if="$slots.header" :class="ui.header()">
      <slot name="header" />
    </div>
    <div :class="ui.content({ class: contentClass })">
      <slot />
    </div>
    <div v-if="$slots.footer" :class="ui.footer()">
      <slot name="footer" />
    </div>
  </component>
</template>

<script setup lang="ts">
/**
 * UiPanel — light surface container for sections/tool surfaces. Use this when
 * content needs a bordered surface but not the stronger framed semantics of
 * UiCard.
 */
import { computed } from "vue";
import { tv } from "./variants";

const {
  tag = "section",
  variant = "surface",
  size = "md",
  radius = "lg",
  shadow = "none",
  tone = "neutral",
  className = "",
  contentClass = "",
} = defineProps<{
  tag?: "div" | "section" | "article" | "aside" | "li";
  variant?: "surface" | "subtle" | "transparent";
  size?: "xs" | "sm" | "md" | "lg";
  /** Corner radius — "lg" (default) matches the standard card radius. */
  radius?: "lg" | "xl" | "2xl";
  /** Resting shadow elevation — "none" (default) is flat. */
  shadow?: "none" | "sm" | "md" | "lg";
  /** Semantic tint — "neutral" (default) keeps the plain `variant` surface. */
  tone?: "neutral" | "success" | "warning" | "error" | "info";
  className?: string;
  contentClass?: string;
}>();

const panel = tv({
  slots: {
    root: "flex flex-col overflow-hidden border",
    header:
      "flex min-w-0 items-center justify-between gap-3 border-b border-secondary text-sm font-semibold text-content-on-surface",
    content: "min-h-0 min-w-0 flex-1",
    footer: "border-t border-secondary",
  },
  variants: {
    variant: {
      surface: { root: "border-secondary bg-surface" },
      subtle: { root: "border-secondary bg-surface-subtle" },
      transparent: { root: "border-secondary bg-transparent" },
    },
    size: {
      xs: { header: "p-2", content: "p-2", footer: "p-2" },
      sm: { header: "p-3", content: "p-3", footer: "p-3" },
      md: { header: "p-4", content: "p-4", footer: "p-4" },
      lg: { header: "p-6", content: "p-6", footer: "p-6" },
    },
    radius: {
      lg: { root: "rounded-[var(--component-card-radius)]" },
      xl: { root: "rounded-[var(--radius-xl)]" },
      "2xl": { root: "rounded-[var(--radius-2xl)]" },
    },
    shadow: {
      none: {},
      sm: { root: "shadow-[var(--shadow-card)]" },
      md: { root: "shadow-[var(--shadow-dropdown)]" },
      lg: { root: "shadow-[var(--shadow-card-hover)]" },
    },
    tone: {
      neutral: {},
      success: { root: "border-success/20 bg-success/10" },
      warning: { root: "border-warning/20 bg-warning/10" },
      error: { root: "border-error/20 bg-error/10" },
      info: { root: "border-info/20 bg-info/10" },
    },
  },
});

const ui = computed(() => panel({ variant, size, radius, shadow, tone }));
</script>

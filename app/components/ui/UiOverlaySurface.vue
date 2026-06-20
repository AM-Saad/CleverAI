<template>
  <component
    :is="tag"
    :role="role"
    :aria-label="ariaLabel"
    :aria-labelledby="ariaLabelledby"
    :class="ui.root({ class: className })"
  >
    <slot />
  </component>
</template>

<script setup lang="ts">
/**
 * UiOverlaySurface — canonical visual shell for floating/overlay regions:
 * modal bodies, drawer panels, popovers, action menus, toasts, and tooltips.
 * It does not create the overlay behavior; it standardizes the surface tokens
 * those overlay primitives should use.
 */
import { computed } from "vue";
import { tv } from "./variants";

const props = withDefaults(
  defineProps<{
    tag?: "div" | "section" | "aside" | "nav";
    role?: string;
    ariaLabel?: string;
    ariaLabelledby?: string;
    kind?: "modal" | "drawer" | "popover" | "menu" | "toast" | "tooltip";
    size?: "xs" | "sm" | "md" | "lg";
    layer?: "none" | "drawer" | "modal" | "popover" | "toast" | "tooltip";
    className?: string;
  }>(),
  {
    tag: "div",
    role: undefined,
    ariaLabel: undefined,
    ariaLabelledby: undefined,
    kind: "popover",
    size: "md",
    layer: "none",
    className: "",
  },
);

const overlaySurface = tv({
  slots: {
    root:
      "min-w-0 rounded-[var(--radius-xl)] border text-content-on-surface outline-none",
  },
  variants: {
    kind: {
      modal: "border-secondary bg-surface shadow-[var(--shadow-modal)]",
      drawer: "border-secondary bg-surface shadow-[var(--component-drawer-shadow)]",
      popover: "border-secondary bg-surface shadow-[var(--shadow-dropdown)]",
      menu: "border-secondary bg-surface shadow-[var(--shadow-dropdown)]",
      toast: "border-secondary bg-surface shadow-[var(--component-toast-shadow)]",
      tooltip:
        "border-secondary bg-content-on-background text-background shadow-[var(--shadow-dropdown)]",
    },
    size: {
      xs: "p-2 text-xs",
      sm: "p-3 text-sm",
      md: "p-4 text-sm",
      lg: "p-6",
    },
    layer: {
      none: "",
      drawer: "z-[var(--z-drawer)]",
      modal: "z-[var(--z-modal)]",
      popover: "z-[var(--z-popover)]",
      toast: "z-[var(--z-toast)]",
      tooltip: "z-[var(--z-tooltip)]",
    },
  },
});

const ui = computed(() =>
  overlaySurface({
    kind: props.kind,
    size: props.size,
    layer: props.layer,
  }),
);
</script>

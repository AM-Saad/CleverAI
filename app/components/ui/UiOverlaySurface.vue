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
    // NOTE: with a named slot (`root`), tailwind-variants only applies variant
    // values that are slot-keyed objects — bare strings are silently dropped.
    // Every value here MUST be `{ root: "…" }` or the surface loses its
    // background/shadow/z-index (transparent overlays).
    kind: {
      modal: { root: "border-secondary bg-surface shadow-[var(--shadow-modal)]" },
      drawer: { root: "border-secondary bg-surface shadow-[var(--component-drawer-shadow)]" },
      popover: { root: "border-secondary bg-surface shadow-[var(--shadow-dropdown)]" },
      menu: { root: "border-secondary bg-surface shadow-[var(--shadow-dropdown)]" },
      toast: { root: "border-secondary bg-surface shadow-[var(--component-toast-shadow)]" },
      tooltip: {
        root: "border-secondary bg-content-on-background text-background shadow-[var(--shadow-dropdown)]",
      },
    },
    size: {
      xs: { root: "p-2 text-xs" },
      sm: { root: "p-3 text-sm" },
      md: { root: "p-4 text-sm" },
      lg: { root: "p-6" },
    },
    layer: {
      none: { root: "" },
      drawer: { root: "z-[var(--z-drawer)]" },
      modal: { root: "z-[var(--z-modal)]" },
      popover: { root: "z-[var(--z-popover)]" },
      toast: { root: "z-[var(--z-toast)]" },
      tooltip: { root: "z-[var(--z-tooltip)]" },
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

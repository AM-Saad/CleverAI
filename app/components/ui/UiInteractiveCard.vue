<template>
  <component
    :is="componentType"
    :to="to"
    :href="href"
    :target="href ? target : undefined"
    :rel="href && target === '_blank' ? resolvedRel : undefined"
    :type="isButton ? type : undefined"
    :disabled="isButton ? disabled : undefined"
    :aria-disabled="!isButton && disabled ? 'true' : undefined"
    :aria-pressed="isButton && selectable ? String(selected) : undefined"
    :aria-current="isLink && selected ? 'page' : undefined"
    :tabindex="!isButton && disabled ? -1 : undefined"
    :class="ui.root({ class: className })"
    @click="handleClick"
  >
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
 * UiInteractiveCard — a single interactive surface for clickable/selectable
 * content cards. Prefer this over wrapping UiCard in a NuxtLink/button, which
 * easily creates nested interactive controls and broken keyboard semantics.
 *
 * - `to` renders NuxtLink.
 * - `href` renders a native anchor.
 * - neither renders a native button, preserving Enter/Space keyboard behavior.
 */
import { computed, resolveComponent } from "vue";
import { disabledState, focusRing, interactiveTransition, pressedScale, tv } from "./variants";

const emit = defineEmits<{
  click: [event: MouseEvent];
}>();

const props = withDefaults(
  defineProps<{
    to?: string | Record<string, unknown>;
    href?: string;
    target?: "_self" | "_blank" | "_parent" | "_top";
    rel?: string;
    type?: "button" | "submit" | "reset";
    selected?: boolean;
    selectable?: boolean;
    disabled?: boolean;
    variant?: "default" | "outline" | "ghost" | "surface" | "surface-strong";
    size?: "xs" | "sm" | "md" | "lg";
    className?: string;
    contentClass?: string;
  }>(),
  {
    target: "_self",
    rel: undefined,
    type: "button",
    selected: false,
    selectable: false,
    disabled: false,
    variant: "outline",
    size: "md",
    className: "",
    contentClass: "",
  },
);

const isLink = computed(() => Boolean(props.to || props.href));
const isButton = computed(() => !isLink.value);
const componentType = computed(() => {
  if (props.to) return resolveComponent("NuxtLink");
  if (props.href) return "a";
  return "button";
});

const resolvedRel = computed(() => props.rel ?? "noopener noreferrer");

const interactiveCard = tv({
  slots: {
    root: [
      "group flex w-full min-w-0 flex-col overflow-hidden rounded-[var(--component-card-radius)] border text-left",
      interactiveTransition,
      pressedScale,
      disabledState,
      focusRing,
    ].join(" "),
    header:
      "flex items-center justify-between border-b text-content-on-surface",
    content: "min-w-0 flex-1 text-content-on-surface",
    footer: "border-t border-secondary text-content-secondary",
  },
  variants: {
    variant: {
      default: {
        root:
          "border-secondary bg-surface hover:border-border-strong hover:shadow-[var(--shadow-card-hover)]",
        header: "border-secondary",
      },
      outline: {
        root:
          "border-secondary bg-transparent hover:bg-surface-subtle hover:border-border-strong",
        header: "border-secondary",
      },
      ghost: {
        root: "border-transparent bg-transparent hover:bg-surface-subtle",
        header: "border-transparent",
      },
      surface: {
        root:
          "border-surface-strong bg-surface-subtle hover:border-border-strong",
        header: "border-surface-strong",
      },
      "surface-strong": {
        root: "border-surface-strong bg-surface-strong hover:border-border-strong",
        header: "border-surface-strong",
      },
    },
    size: {
      xs: { header: "p-2 text-xs", content: "p-2 text-sm", footer: "p-2 text-xs" },
      sm: { header: "p-3 text-sm", content: "p-3 text-sm", footer: "p-3 text-xs" },
      md: { header: "p-4 text-sm font-medium", content: "p-4", footer: "p-4 text-sm" },
      lg: { header: "p-6 text-base font-medium", content: "p-6", footer: "p-6 text-sm" },
    },
    selected: {
      true: {
        root:
          "border-primary bg-primary/10 shadow-[var(--shadow-primary-glow)]",
      },
      false: {},
    },
  },
});

const ui = computed(() =>
  interactiveCard({
    variant: props.variant,
    size: props.size,
    selected: props.selected,
  }),
);

function handleClick(event: MouseEvent) {
  if (props.disabled) {
    event.preventDefault();
    event.stopPropagation();
    return;
  }
  emit("click", event);
}
</script>

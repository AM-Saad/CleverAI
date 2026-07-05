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
    :aria-pressed="isButton && selectable ? String(active) : undefined"
    :aria-current="isLink && active ? 'page' : undefined"
    :tabindex="!isButton && disabled ? -1 : undefined"
    :class="ui.root({ class: className })"
    :style="pillStyle"
    @click="handleClick"
  >
    <span v-if="$slots.indicator" :class="ui.indicator()">
      <slot name="indicator" />
    </span>

    <span v-if="$slots.default || displayLabel" :class="ui.label()">
      <slot>{{ displayLabel }}</slot>
    </span>

    <span v-if="$slots.icon || icon" :class="ui.icon()">
      <slot name="icon">
        <UiPillIcon v-if="icon" :name="icon" :size="size" />
      </slot>
    </span>
  </component>
</template>

<script setup lang="ts">
/**
 * UiPill — compact chip/pill primitive for workspace affordances, filters,
 * tags, counts, and status labels. It can be presentational, a button, or a
 * link while keeping the same three-part anatomy: indicator, label, icon.
 */
import { computed, resolveComponent } from "vue";
import {
  disabledState,
  focusRing,
  interactiveTransition,
  pressedScale,
  tv,
} from "./variants";

const emit = defineEmits<{
  click: [event: MouseEvent];
}>();

const props = withDefaults(
  defineProps<{
    as?: "span" | "div" | "li";
    to?: string | Record<string, unknown>;
    href?: string;
    target?: "_self" | "_blank" | "_parent" | "_top";
    rel?: string;
    type?: "button" | "submit" | "reset";
    clickable?: boolean;
    selectable?: boolean;
    active?: boolean;
    disabled?: boolean;
    label?: string | number;
    icon?: string;
    color?: string;
    fillTextColor?: string;
    variant?: "soft" | "fill" | "outline" | "dashed" | "ghost";
    size?: "md" | "sm";
    maxChars?: number;
    maxWidth?: string;
    className?: string;
  }>(),
  {
    as: "span",
    target: "_self",
    rel: undefined,
    type: "button",
    clickable: false,
    selectable: false,
    active: false,
    disabled: false,
    label: "",
    icon: "",
    color: "var(--color-primary)",
    fillTextColor: "var(--color-white)",
    variant: "soft",
    size: "md",
    maxChars: 200,
    maxWidth: "min(60vw, 260px)",
    className: "",
  },
);

const isLink = computed(() => Boolean(props.to || props.href));
const isButton = computed(() => !isLink.value && props.clickable);
const isInteractive = computed(() => isLink.value || isButton.value);
const componentType = computed(() => {
  if (props.to) return resolveComponent("NuxtLink");
  if (props.href) return "a";
  if (props.clickable) return "button";
  return props.as;
});
const resolvedRel = computed(() => props.rel ?? "noopener noreferrer");

const displayLabel = computed(() => {
  const raw = String(props.label ?? "");
  const max = Math.max(0, props.maxChars);
  if (raw.length <= max) return raw;
  if (max <= 3) return raw.slice(0, max);
  return `${raw.slice(0, max - 3)}...`;
});

const pillStyle = computed(() => ({
  "--ui-pill-color": props.color,
  "--ui-pill-fill-text": props.fillTextColor,
  "--ui-pill-max-width": props.maxWidth,
}));

const pill = tv({
  slots: {
    root: [
      "ui-pill inline-flex min-w-0 max-w-full items-center rounded-[var(--radius-full)] border outline-none",
      disabledState,
    ].join(" "),
    indicator: "ui-pill__indicator inline-flex shrink-0 items-center",
    label: "ui-pill__label min-w-0 truncate font-semibold",
    icon: "ui-pill__icon inline-flex shrink-0 items-center justify-center",
  },
  variants: {
    variant: {
      soft: { root: "ui-pill--soft" },
      fill: { root: "ui-pill--fill" },
      outline: { root: "ui-pill--outline" },
      dashed: { root: "ui-pill--dashed" },
      ghost: { root: "ui-pill--ghost" },
    },
    size: {
      md: {
        root: "min-h-8 gap-1.5 px-3 py-1.5 text-[13px]",
        label: "leading-5",
      },
      sm: {
        root: "min-h-[22px] gap-1 px-2 py-0.5 text-[11px]",
        label: "leading-4",
      },
    },
    active: {
      true: { root: "ui-pill--active" },
      false: {},
    },
    interactive: {
      true: {
        root: [
          "ui-pill--interactive cursor-pointer",
          interactiveTransition,
          pressedScale,
          focusRing,
        ].join(" "),
      },
      false: {},
    },
  },
});

const ui = computed(() =>
  pill({
    variant: props.variant,
    size: props.size,
    active: props.active,
    interactive: isInteractive.value,
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

<style scoped>
.ui-pill {
  max-width: var(--ui-pill-max-width);
  letter-spacing: 0;
}

.ui-pill--soft {
  border-color: var(--color-secondary);
  background: var(--color-surface-subtle);
  color: var(--color-content-on-surface-strong);
}

.ui-pill--fill {
  border-color: var(--ui-pill-color);
  background: var(--ui-pill-color);
  color: var(--ui-pill-fill-text);
}

.ui-pill--outline {
  border-color: color-mix(
    in srgb,
    var(--ui-pill-color) 55%,
    var(--color-secondary)
  );
  background: transparent;
  color: var(--ui-pill-color);
}

.ui-pill--dashed {
  border-style: dashed;
  border-color: color-mix(
    in srgb,
    var(--ui-pill-color) 60%,
    var(--color-border-strong)
  );
  background: transparent;
  color: var(--ui-pill-color);
}

.ui-pill--ghost {
  border-color: transparent;
  background: transparent;
  color: var(--color-content-secondary);
}

.ui-pill--active:not(.ui-pill--fill) {
  border-width: 1.5px;
  border-color: var(--ui-pill-color);
  background: color-mix(in srgb, var(--ui-pill-color) 12%, transparent);
  color: var(--ui-pill-color);
  font-weight: 700;
}

.ui-pill--interactive:not(.ui-pill--active):not(.ui-pill--fill):hover:not(
    :disabled
  ):not([aria-disabled="true"]) {
  border-color: var(--color-border-strong);
  background: var(--color-surface-strong);
}

.ui-pill--interactive.ui-pill--fill:hover:not(:disabled):not(
    [aria-disabled="true"]
  ) {
  border-color: var(--ui-pill-color);
  background: var(--ui-pill-color);
  color: var(--ui-pill-fill-text);
}
</style>

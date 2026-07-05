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
    :aria-labelledby="ariaLabelledby"
    :aria-describedby="ariaDescribedby"
    :tabindex="!isButton && disabled ? -1 : undefined"
    :class="ui.root({ class: className })"
    @click="handleClick"
  >
    <span
      v-if="$slots.leading"
      :class="ui.leading({ class: leadingClass })"
      :style="leadingStyle"
    >
      <slot name="leading" />
    </span>

    <span :class="ui.main({ class: contentClass })">
      <span v-if="$slots.title || title" :id="titleId" :class="ui.title()">
        <slot name="title">{{ title }}</slot>
      </span>
      <span
        v-if="$slots.description || description"
        :id="descriptionId"
        :class="ui.description()"
      >
        <slot name="description">{{ description }}</slot>
      </span>
      <slot />
    </span>

    <span
      v-if="$slots.trailing || trailingText"
      :class="ui.trailing({ class: trailingClass })"
    >
      <slot name="trailing">{{ trailingText }}</slot>
    </span>

    <span v-if="$slots.action" :class="ui.action({ class: actionClass })">
      <slot name="action" />
    </span>
  </component>
</template>

<script setup lang="ts">
/**
 * UiListCard — compact row/card primitive for list navigation, selectable rows,
 * and static setting rows. It centralizes the account-row interaction language:
 * one leading affordance, text stack, optional trailing detail, and final action.
 */
import { computed, resolveComponent, useAttrs, useSlots } from "vue";
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
    as?: "div" | "article" | "section" | "li";
    to?: string | Record<string, unknown>;
    href?: string;
    target?: "_self" | "_blank" | "_parent" | "_top";
    rel?: string;
    type?: "button" | "submit" | "reset";
    clickable?: boolean;
    selected?: boolean;
    selectable?: boolean;
    disabled?: boolean;
    title?: string;
    description?: string;
    trailingText?: string;
    variant?: "card" | "soft" | "ghost" | "dashed";
    size?: "sm" | "md" | "lg";
    leadingBackground?: string;
    leadingColor?: string;
    className?: string;
    leadingClass?: string;
    contentClass?: string;
    trailingClass?: string;
    actionClass?: string;
  }>(),
  {
    as: "div",
    target: "_self",
    rel: undefined,
    type: "button",
    clickable: false,
    selected: false,
    selectable: false,
    disabled: false,
    title: "",
    description: "",
    trailingText: "",
    variant: "card",
    size: "md",
    leadingBackground: "var(--color-surface-subtle)",
    leadingColor: "var(--color-content-secondary)",
    className: "",
    leadingClass: "",
    contentClass: "",
    trailingClass: "",
    actionClass: "",
  },
);

const attrs = useAttrs();
const slots = useSlots();
const baseId = useId();

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
const titleId = computed(() => `${baseId}-title`);
const descriptionId = computed(() => `${baseId}-description`);
const hasTitle = computed(() => Boolean(props.title || slots.title));
const hasDescription = computed(() =>
  Boolean(props.description || slots.description),
);
const ariaLabelledby = computed(() => {
  if (attrs["aria-label"] || attrs["aria-labelledby"] || !hasTitle.value)
    return undefined;
  return titleId.value;
});
const ariaDescribedby = computed(() => {
  if (attrs["aria-describedby"] || !hasDescription.value) return undefined;
  return descriptionId.value;
});
const leadingStyle = computed(() => ({
  background: props.leadingBackground,
  color: props.leadingColor,
}));

const listCard = tv({
  slots: {
    root: [
      "flex w-full min-w-0 items-center gap-3 rounded-[var(--radius-2xl)] border text-left outline-none",
      "text-content-on-surface",
      disabledState,
    ].join(" "),
    leading:
      "grid shrink-0 place-items-center rounded-[var(--radius-lg)] text-content-secondary",
    main: "flex min-w-0 flex-1 flex-col justify-center",
    title: "min-w-0 truncate font-semibold text-content-on-surface-strong",
    description: "min-w-0 truncate text-content-secondary",
    trailing:
      "ml-auto inline-flex shrink-0 items-center justify-end gap-1.5 text-content-secondary",
    action:
      "inline-flex shrink-0 items-center justify-center text-content-disabled",
  },
  variants: {
    variant: {
      card: {
        root: "border-secondary bg-[var(--ds-surface-card)] shadow-[var(--shadow-card)]",
      },
      soft: {
        root: "border-secondary bg-surface-subtle",
      },
      ghost: {
        root: "border-transparent bg-transparent shadow-none",
      },
      dashed: {
        root: "border-dashed border-border-strong bg-transparent shadow-none",
      },
    },
    size: {
      sm: {
        root: "min-h-11 px-3 py-2",
        leading: "h-8 w-8 text-sm",
        title: "text-sm",
        description: "text-[12px]",
        trailing: "text-xs",
      },
      md: {
        root: "min-h-[58px] px-3 py-3",
        leading: "h-[34px] w-[34px] text-base",
        title: "text-[15px]",
        description: "text-[12.5px]",
        trailing: "text-[13px]",
      },
      lg: {
        root: "min-h-16 px-3 py-3",
        leading: "h-[42px] w-[42px] text-lg",
        title: "text-[15px] font-bold",
        description: "text-[12.5px]",
        trailing: "text-[13px]",
      },
    },
    interactive: {
      true: {
        root: [
          "cursor-pointer",
          interactiveTransition,
          pressedScale,
          focusRing,
          "hover:border-border-strong hover:bg-surface-subtle hover:shadow-[var(--shadow-card-hover)]",
          "active:bg-surface-subtle",
        ].join(" "),
      },
      false: {},
    },
    selected: {
      true: {
        root: "border-2 border-primary bg-primary/10 shadow-[var(--shadow-card)]",
        action: "text-primary",
      },
      false: {},
    },
  },
});

const ui = computed(() =>
  listCard({
    variant: props.variant,
    size: props.size,
    selected: props.selected,
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

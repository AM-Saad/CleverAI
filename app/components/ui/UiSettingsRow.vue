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
    :aria-labelledby="ariaLabelledby"
    :aria-describedby="ariaDescribedby"
    :tabindex="!isButton && disabled ? -1 : undefined"
    :class="ui.root({ class: className })"
    @click="handleClick"
  >
    <span v-if="$slots.leading" :class="ui.leading({ class: leadingClass })">
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

    <span v-if="$slots.trailing || trailingText" :class="ui.trailing()">
      <slot name="trailing">{{ trailingText }}</slot>
    </span>

    <span v-if="$slots.control" :class="ui.control({ class: controlClass })">
      <slot name="control" />
    </span>
  </component>
</template>

<script setup lang="ts">
/**
 * UiSettingsRow - one row in a grouped settings surface.
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
    as?: "div" | "li" | "article";
    to?: string | Record<string, unknown>;
    href?: string;
    target?: "_self" | "_blank" | "_parent" | "_top";
    rel?: string;
    type?: "button" | "submit" | "reset";
    clickable?: boolean;
    disabled?: boolean;
    title?: string;
    description?: string;
    trailingText?: string;
    size?: "sm" | "md";
    className?: string;
    leadingClass?: string;
    contentClass?: string;
    controlClass?: string;
  }>(),
  {
    as: "div",
    target: "_self",
    rel: undefined,
    type: "button",
    clickable: false,
    disabled: false,
    title: "",
    description: "",
    trailingText: "",
    size: "md",
    className: "",
    leadingClass: "",
    contentClass: "",
    controlClass: "",
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
  if (attrs["aria-label"] || attrs["aria-labelledby"] || !hasTitle.value) {
    return undefined;
  }
  return titleId.value;
});
const ariaDescribedby = computed(() => {
  if (attrs["aria-describedby"] || !hasDescription.value) return undefined;
  return descriptionId.value;
});

const row = tv({
  slots: {
    root: [
      "ui-settings-row flex w-full min-w-0 items-center justify-between gap-3 text-left outline-none",
      "text-content-on-surface",
      disabledState,
    ].join(" "),
    leading:
      "grid h-8 w-8 shrink-0 place-items-center rounded-[var(--radius-lg)] bg-surface-subtle text-content-secondary",
    main: "flex min-w-0 flex-1 flex-col justify-center",
    title: "min-w-0 font-semibold leading-snug text-content-on-surface-strong",
    description: "mt-0.5 min-w-0 text-content-secondary",
    trailing:
      "inline-flex shrink-0 items-center gap-1.5 text-content-secondary",
    control: "inline-flex shrink-0 items-center justify-end",
  },
  variants: {
    size: {
      sm: {
        root: "min-h-12 px-3 py-2.5",
        title: "text-sm",
        description: "text-xs",
      },
      md: {
        root: "min-h-[58px] px-4 py-3",
        title: "text-[15px]",
        description: "text-[12.5px]",
      },
    },
    interactive: {
      true: {
        root: [
          "cursor-pointer",
          interactiveTransition,
          pressedScale,
          focusRing,
          "hover:bg-surface-subtle active:bg-surface-subtle",
        ].join(" "),
      },
      false: {},
    },
  },
});

const ui = computed(() =>
  row({
    size: props.size,
    interactive: isInteractive.value,
  }),
);

function handleClick(event: MouseEvent) {
  if (!isInteractive.value) return;
  if (props.disabled) {
    event.preventDefault();
    event.stopPropagation();
    return;
  }
  emit("click", event);
}
</script>

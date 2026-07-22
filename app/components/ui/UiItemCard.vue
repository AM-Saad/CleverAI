<template>
  <component
    :is="as"
    :role="clickable ? 'button' : undefined"
    :tabindex="clickable && !disabled ? 0 : undefined"
    :aria-disabled="clickable && disabled ? 'true' : undefined"
    :aria-pressed="clickable && selected ? 'true' : undefined"
    :data-spine="spine ? '' : undefined"
    :style="itemStyle"
    :class="ui.root({ class: className })"
    @click="handleClick"
    @keydown="handleKeydown"
  >
    <div v-if="$slots.status" :class="ui.status()">
      <slot name="status" />
    </div>

    <div v-if="hasHeader" :class="ui.header({ class: headerClass })">
      <div v-if="$slots.leading" :class="ui.leading()">
        <slot name="leading" />
      </div>

      <div :class="ui.main()">
        <div v-if="$slots.kicker" :class="ui.kicker()">
          <slot name="kicker" />
        </div>

        <div
          v-if="$slots.title || title || $slots.badges"
          :class="ui.titleRow()"
        >
          <h3
            v-if="$slots.title || title"
            :class="ui.title({ class: titleClass })"
          >
            <slot name="title">{{ title }}</slot>
          </h3>
          <div v-if="$slots.badges" :class="ui.badges()">
            <slot name="badges" />
          </div>
        </div>

        <div v-if="$slots.subtitle || subtitle" :class="ui.subtitle()">
          <slot name="subtitle">{{ subtitle }}</slot>
        </div>
      </div>

      <div v-if="$slots.actions" :class="ui.actions()">
        <slot name="actions" />
      </div>
    </div>

    <div v-if="showDefaultBody" :class="ui.body({ class: bodyClass })">
      <slot />
    </div>

    <div v-if="$slots.footer" :class="ui.footer({ class: footerClass })">
      <slot name="footer" />
    </div>
  </component>
</template>

<script setup lang="ts">
/**
 * UiItemCard - shared item-card presentation for word, note, and board items.
 * It owns the card shell and item anatomy while feature code owns content,
 * domain actions, and drag/edit behavior.
 */
import { computed, useSlots } from "vue";
import {
  disabledState,
  focusRing,
  interactiveTransition,
  pressedScale,
  tv,
} from "./variants";

const emit = defineEmits<{
  click: [event: MouseEvent | KeyboardEvent];
}>();

const props = withDefaults(
  defineProps<{
    as?: "article" | "div" | "li" | "section";
    title?: string;
    subtitle?: string;
    variant?: "card" | "soft";
    size?: "sm" | "md";
    clickable?: boolean;
    selected?: boolean;
    disabled?: boolean;
    showBody?: boolean;
    spine?: string;
    className?: string;
    headerClass?: string;
    titleClass?: string;
    bodyClass?: string;
    footerClass?: string;
  }>(),
  {
    as: "article",
    title: "",
    subtitle: "",
    variant: "card",
    size: "md",
    clickable: false,
    selected: false,
    disabled: false,
    showBody: true,
    spine: "",
    className: "",
    headerClass: "",
    titleClass: "",
    bodyClass: "",
    footerClass: "",
  },
);

const slots = useSlots();
const hasHeader = computed(() =>
  Boolean(
    slots.leading ||
    slots.kicker ||
    slots.title ||
    props.title ||
    slots.badges ||
    slots.subtitle ||
    props.subtitle ||
    slots.actions,
  ),
);
const showDefaultBody = computed(() =>
  Boolean(slots.default && props.showBody),
);
const itemStyle = computed(() =>
  props.spine ? { "--ui-item-card-spine": props.spine } : undefined,
);

const itemCard = tv({
  slots: {
    root: [
      "ui-item-card relative flex min-w-0 flex-col overflow-hidden rounded-[var(--component-card-radius)] border text-left outline-none",
      "text-content-on-surface",
      disabledState,
    ].join(" "),
    status: "absolute right-3 top-3 z-10",
    header: "flex min-w-0 items-start justify-between gap-3",
    leading: "shrink-0",
    main: "min-w-0 flex-1",
    kicker: "mb-2 flex min-w-0 flex-wrap items-center gap-1.5",
    titleRow: "flex min-w-0 flex-wrap items-center gap-2",
    title:
      "min-w-0 truncate font-semibold leading-snug text-content-on-surface-strong",
    badges: "flex min-w-0 flex-wrap items-center gap-1.5",
    subtitle:
      "mt-1 flex min-w-0 flex-wrap items-center gap-2 text-content-secondary",
    actions: "flex shrink-0 items-center gap-1",
    body: "min-w-0 text-content-secondary",
    footer: "flex min-w-0 flex-wrap items-center gap-2 text-content-disabled",
  },
  variants: {
    variant: {
      card: {
        root: "border-secondary bg-[var(--ds-surface-card)] shadow-[var(--shadow-card)]",
      },
      soft: {
        root: "border-secondary bg-surface-subtle",
      },
    },
    size: {
      sm: {
        root: "ui-item-card--sm gap-2 p-3",
        title: "text-sm",
        subtitle: "text-xs",
        body: "text-xs leading-relaxed",
        footer: "text-[11px]",
      },
      md: {
        root: "ui-item-card--md gap-3 p-4",
        title: "text-base",
        subtitle: "text-sm",
        body: "text-sm leading-relaxed",
        footer: "text-xs",
      },
    },
    clickable: {
      true: {
        root: [
          "cursor-pointer",
          interactiveTransition,
          pressedScale,
          focusRing,
          "hover:border-border-strong hover:bg-surface-subtle hover:shadow-[var(--shadow-card-hover)]",
        ].join(" "),
      },
      false: {},
    },
    selected: {
      true: {
        root: "border-2 border-primary bg-primary/10 shadow-[var(--shadow-card)]",
      },
      false: {},
    },
  },
});

const ui = computed(() =>
  itemCard({
    variant: props.variant,
    size: props.size,
    clickable: props.clickable,
    selected: props.selected,
  }),
);

function handleClick(event: MouseEvent) {
  if (!props.clickable) return;
  if (props.disabled) {
    event.preventDefault();
    event.stopPropagation();
    return;
  }
  emit("click", event);
}

function handleKeydown(event: KeyboardEvent) {
  if (!props.clickable || props.disabled) return;
  if (event.key !== "Enter" && event.key !== " ") return;
  event.preventDefault();
  emit("click", event);
}
</script>

<style scoped>
.ui-item-card[data-spine]::before {
  content: "";
  position: absolute;
  bottom: 0;
  left: 0;
  top: 0;
  width: 5px;
  background: var(--ui-item-card-spine);
}

.ui-item-card--sm[data-spine] {
  padding-left: calc(var(--space-3) + var(--space-2));
}

.ui-item-card--md[data-spine] {
  padding-left: calc(var(--space-4) + var(--space-2));
}
</style>

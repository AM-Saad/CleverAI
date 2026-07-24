<template>
  <div
    role="radiogroup"
    :aria-label="label"
    :class="ui.root({ class: fullWidth ? 'w-full' : '' })"
  >
    <button
      v-for="(item, index) in items"
      :key="item.value"
      :ref="(element) => setButtonRef(element, index)"
      type="button"
      role="radio"
      :aria-checked="model === item.value"
      :aria-disabled="item.disabled ? 'true' : undefined"
      :disabled="item.disabled"
      :tabindex="tabIndexFor(item, index)"
      :class="ui.item({ selected: model === item.value })"
      @click="select(item, index)"
      @keydown="onKeydown($event, index)"
    >
      <UiIcon
        v-if="item.icon"
        :name="item.icon"
        class="h-4 w-4"
        aria-hidden="true"
      />
      <span class="whitespace-nowrap">{{ item.label }}</span>
      <span
        v-if="item.count !== undefined"
        :class="ui.count({ selected: model === item.value })"
        >{{ item.count }}</span
      >
    </button>
  </div>
</template>

<script setup lang="ts">
import type { ComponentPublicInstance } from "vue";
import { nextTick, ref } from "vue";
import {
  disabledState,
  focusRing,
  interactiveTransition,
  tv,
} from "./variants";

export interface SegmentedControlItem {
  value: string;
  label: string;
  icon?: string;
  count?: number;
  disabled?: boolean;
}

const model = defineModel<string>({ required: true });
const props = withDefaults(
  defineProps<{
    label: string;
    items: readonly SegmentedControlItem[];
    size?: "sm" | "md";
    fullWidth?: boolean;
  }>(),
  { size: "md", fullWidth: false },
);

const buttonRefs = ref<Array<HTMLButtonElement | null>>([]);
const segmented = tv({
  slots: {
    root: "inline-flex items-stretch rounded-[var(--radius-lg)] border border-secondary bg-surface-subtle p-1",
    item: [
      "inline-flex min-w-0 flex-1 items-center justify-center gap-2 rounded-[var(--radius-lg)] font-medium text-content-secondary",
      interactiveTransition,
      disabledState,
      focusRing,
      "hover:bg-surface hover:text-content-on-surface-strong",
    ].join(" "),
    count:
      "inline-flex min-w-[18px] shrink-0 items-center justify-center rounded-full px-1 text-[10px] font-bold",
  },
  variants: {
    size: {
      sm: { item: "min-h-[var(--target-compact)] px-3 text-sm" },
      md: { item: "min-h-[var(--target-touch)] px-4 text-sm" },
    },
    selected: {
      true: {
        item: "bg-primary text-on-primary hover:bg-primary-hover hover:text-on-primary",
        count:
          "bg-[color-mix(in_srgb,var(--color-on-primary)_20%,transparent)] text-on-primary",
      },
      false: {
        count:
          "bg-[color-mix(in_srgb,var(--color-content-on-background)_7%,transparent)] text-content-secondary",
      },
    },
  },
});
const ui = computed(() => segmented({ size: props.size }));

function setButtonRef(
  element: Element | ComponentPublicInstance | null,
  index: number,
) {
  buttonRefs.value[index] =
    element instanceof HTMLButtonElement ? element : null;
}

function firstEnabledIndex() {
  return props.items.findIndex((item) => !item.disabled);
}

function tabIndexFor(item: SegmentedControlItem, index: number) {
  if (item.disabled) return -1;
  if (model.value === item.value) return 0;
  return model.value ? -1 : index === firstEnabledIndex() ? 0 : -1;
}

function select(item: SegmentedControlItem, index: number) {
  if (item.disabled) return;
  model.value = item.value;
  nextTick(() => buttonRefs.value[index]?.focus());
}

function enabledIndexFrom(start: number, direction: 1 | -1) {
  if (!props.items.length) return -1;
  let index = start;
  for (let visited = 0; visited < props.items.length; visited += 1) {
    index = (index + direction + props.items.length) % props.items.length;
    if (!props.items[index]?.disabled) return index;
  }
  return -1;
}

function boundaryIndex(direction: 1 | -1) {
  const start = direction === 1 ? -1 : props.items.length;
  return enabledIndexFrom(start, direction);
}

function onKeydown(event: KeyboardEvent, index: number) {
  let target = -1;
  if (["ArrowRight", "ArrowDown"].includes(event.key))
    target = enabledIndexFrom(index, 1);
  if (["ArrowLeft", "ArrowUp"].includes(event.key))
    target = enabledIndexFrom(index, -1);
  if (event.key === "Home") target = boundaryIndex(1);
  if (event.key === "End") target = boundaryIndex(-1);
  if (target < 0) return;
  event.preventDefault();
  const item = props.items[target];
  if (item) select(item, target);
}
</script>

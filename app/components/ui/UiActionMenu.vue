<template>
  <UDropdownMenu
    :items="confirmedItems"
    :content="props.content"
    :modal="props.modal"
    v-bind="$attrs"
  >
    <slot>
      <UiIconButton
        :icon="props.icon"
        :label="props.label"
        :size="props.size"
        variant="ghost"
        tone="neutral"
        :disabled="props.disabled"
      />
    </slot>
  </UDropdownMenu>
</template>

<script setup lang="ts">
/**
 * UiActionMenu — canonical compact actions menu. Feature code should use this
 * instead of reaching for Nuxt UI `UDropdownMenu` directly.
 */
import type { ControlSize } from "./variants";
import { computed, onBeforeUnmount, ref, watch } from "vue";

type ActionMenuSelectEvent = { preventDefault?: () => void };
type ActionMenuItem = Record<string, unknown> & {
  id?: string;
  label?: string;
  icon?: string;
  onSelect?: (event?: ActionMenuSelectEvent) => void;
  requiresDoubleTap?: boolean;
  confirmLabel?: string;
  confirmIcon?: string;
  disabled?: boolean;
};

const props = withDefaults(
  defineProps<{
    items: ActionMenuItem[] | ActionMenuItem[][];
    content?: Record<string, unknown>;
    modal?: boolean;
    icon?: string;
    label?: string;
    size?: ControlSize;
    disabled?: boolean;
  }>(),
  {
    content: () => ({ align: "end", side: "bottom", sideOffset: 4 }),
    modal: false,
    icon: "i-lucide-more-horizontal",
    label: "Actions",
    size: "sm",
    disabled: false,
  },
);

defineOptions({ inheritAttrs: false });

const armedKey = ref<string | null>(null);
let resetTimer: ReturnType<typeof setTimeout> | null = null;
const CONFIRM_WINDOW_MS = 2500;

function clearResetTimer() {
  if (!resetTimer) return;
  clearTimeout(resetTimer);
  resetTimer = null;
}

function resetArmed() {
  armedKey.value = null;
  clearResetTimer();
}

function armItem(key: string) {
  armedKey.value = key;
  clearResetTimer();
  resetTimer = setTimeout(resetArmed, CONFIRM_WINDOW_MS);
}

function itemKey(item: ActionMenuItem, path: string) {
  return String(item.id ?? item.label ?? path);
}

function enhanceItem(item: ActionMenuItem, path: string): ActionMenuItem {
  if (!item.requiresDoubleTap) return item;

  const key = itemKey(item, path);
  const isArmed = armedKey.value === key;
  const originalOnSelect = item.onSelect;

  return {
    ...item,
    label: isArmed ? (item.confirmLabel ?? "Select again to delete") : item.label,
    icon: isArmed ? (item.confirmIcon ?? "i-lucide-alert-triangle") : item.icon,
    onSelect: (event?: ActionMenuSelectEvent) => {
      if (item.disabled) return;

      if (!isArmed) {
        event?.preventDefault?.();
        armItem(key);
        return;
      }

      resetArmed();
      originalOnSelect?.(event);
    },
  };
}

const confirmedItems = computed(() =>
  props.items.map((entry, groupIndex) => {
    if (Array.isArray(entry)) {
      return entry.map((item, itemIndex) =>
        enhanceItem(item as ActionMenuItem, `${groupIndex}:${itemIndex}`),
      );
    }

    return enhanceItem(entry as ActionMenuItem, `${groupIndex}`);
  }),
);

watch(
  () => props.items,
  () => resetArmed(),
);

onBeforeUnmount(resetArmed);
</script>

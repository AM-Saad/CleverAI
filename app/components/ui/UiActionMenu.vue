<template>
  <UDropdownMenu
    :items="props.items"
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
import type { Size } from "./variants";

type ActionMenuItem = Record<string, unknown>;

const props = withDefaults(
  defineProps<{
    items: ActionMenuItem[] | ActionMenuItem[][];
    content?: Record<string, unknown>;
    modal?: boolean;
    icon?: string;
    label?: string;
    size?: Size;
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
</script>

<template>
  <UiTooltip :text="tooltip || label || ''" :disabled="!(tooltip || label)">
    <UiButton
      :tone="tone"
      :variant="active ? 'soft' : variant"
      :size="size"
      :icon="iconOnly ? icon : undefined"
      :leading-icon="!iconOnly ? icon : undefined"
      :disabled="disabled"
      :loading="loading"
      :square="iconOnly"
      :aria-label="label || tooltip"
      :aria-pressed="active || undefined"
      v-bind="$attrs"
      @click="$emit('click', $event)"
    >
      <span v-if="!iconOnly">
        <slot>{{ label }}</slot>
      </span>
    </UiButton>
  </UiTooltip>
</template>

<script setup lang="ts">
/**
 * UiToolbarButton — canonical toolbar command button. Prefer this over raw
 * button styling in editor/board/note toolbars.
 */
import type { ActionTone, ControlSize } from "./variants";

withDefaults(
  defineProps<{
    icon?: string;
    label?: string;
    tooltip?: string;
    tone?: ActionTone;
    variant?: "solid" | "soft" | "ghost" | "link";
    size?: ControlSize;
    active?: boolean;
    disabled?: boolean;
    loading?: boolean;
    iconOnly?: boolean;
  }>(),
  {
    tone: "neutral",
    variant: "ghost",
    size: "xs",
    active: false,
    disabled: false,
    loading: false,
    iconOnly: true,
  },
);

defineEmits<{ click: [event: MouseEvent] }>();
defineOptions({ inheritAttrs: false });
</script>

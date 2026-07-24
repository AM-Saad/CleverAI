<template>
  <USlider
    v-model="model"
    :min="min"
    :max="max"
    :step="step"
    :size="size"
    :disabled="disabled"
    v-bind="$attrs"
  />
</template>

<script setup lang="ts">
/**
 * UiSlider — single/range numeric slider. Thin wrapper over the themed
 * Nuxt UI `USlider`.
 */
import type { ControlSize } from "./variants";

const model = defineModel<number | number[]>();
const {
  min = 0,
  max = 100,
  step = 1,
  size = "md",
  disabled = false,
} = defineProps<{
  min?: number;
  max?: number;
  step?: number;
  size?: ControlSize;
  disabled?: boolean;
}>();
defineOptions({ inheritAttrs: false });
</script>

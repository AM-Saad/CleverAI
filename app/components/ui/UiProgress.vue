<template>
  <UProgress :model-value="value" :max="max" :size="size" :color="tone" :animation="animation" v-bind="$attrs" />
</template>

<script setup lang="ts">
/**
 * UiProgress — determinate/indeterminate progress bar. Thin wrapper over the
 * themed `UProgress`. Pass `value` (null for indeterminate).
 */
import type { Size, Tone } from "./variants";

const { value, max = 100, size = "md", tone = "primary", animation } = defineProps<{
  value?: number | null;
  max?: number;
  size?: Size;
  tone?: Tone;
  animation?: "carousel" | "carousel-inverse" | "swing" | "elastic";
}>();
defineOptions({ inheritAttrs: false });
</script>

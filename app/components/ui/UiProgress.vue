<template>
  <UProgress
    :model-value="value"
    :max="max"
    :size="size"
    :color="color"
    :animation="animation"
    v-bind="$attrs"
  />
</template>

<script setup lang="ts">
/**
 * UiProgress — determinate/indeterminate progress bar. Thin wrapper over the
 * themed `UProgress`. Pass `value` (null for indeterminate).
 */
import type { Size, Tone } from "./variants";
import { computed } from "vue";

type LegacyTone = Tone | "secondary";

const {
  value,
  max = 100,
  size = "md",
  tone = "primary",
  color: legacyColor,
  animation,
} = defineProps<{
  value?: number | null;
  max?: number;
  size?: Size;
  tone?: Tone;
  /** @deprecated Use `tone`. Kept as a migration bridge for legacy call sites. */
  color?: LegacyTone;
  animation?: "carousel" | "carousel-inverse" | "swing" | "elastic";
}>();
defineOptions({ inheritAttrs: false });

const color = computed(() =>
  legacyColor === "secondary" ? "neutral" : (legacyColor ?? tone),
);
</script>

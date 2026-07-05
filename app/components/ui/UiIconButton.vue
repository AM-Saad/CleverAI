<template>
  <UiButton
    :tone="tone"
    :variant="variant"
    :size="size"
    :icon="icon"
    :loading="loading"
    :disabled="disabled"
    :active="active"
    square
    :aria-label="label"
    :aria-pressed="pressed === undefined ? undefined : String(pressed)"
    :title="label"
    v-bind="$attrs"
  />
</template>

<script setup lang="ts">
/**
 * UiIconButton — a square, icon-only button. Wraps UiButton with `square` and a
 * required accessible label. Consolidates the many bespoke toolbar/icon buttons.
 */
import type { Size, Tone } from "./variants";

const {
  icon,
  label,
  tone = "neutral",
  variant = "ghost",
  size = "md",
  loading = false,
  disabled = false,
  active = false,
  pressed = undefined,
} = defineProps<{
  /** Icon name (e.g. 'i-lucide-trash'). */
  icon: string;
  /** Accessible label — required (icon-only has no text). */
  label: string;
  tone?: Tone;
  variant?: "solid" | "soft" | "ghost" | "link";
  size?: Size;
  loading?: boolean;
  disabled?: boolean;
  active?: boolean;
  pressed?: boolean;
}>();

defineOptions({ inheritAttrs: false });
</script>

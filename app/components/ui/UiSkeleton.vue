<template>
  <div :class="skeleton({ shape })" :style="{ width, height }" aria-hidden="true" v-bind="$attrs" />
</template>

<script setup lang="ts">
/**
 * UiSkeleton — loading placeholder block. Token-styled, tone-neutral. Replaces
 * the ad-hoc shimmer blocks (raw gray palette fills) scattered across loading states.
 */
import { tv } from "./variants";

const { shape = "rect", width, height } = defineProps<{
  shape?: "rect" | "text" | "circle";
  /** Any CSS length (e.g. '2rem', '100%'). */
  width?: string;
  height?: string;
}>();

defineOptions({ inheritAttrs: false });

const skeleton = tv({
  base: "animate-pulse bg-surface-strong",
  variants: {
    shape: {
      rect: "rounded-[var(--radius-md)]",
      text: "rounded-[var(--radius-sm)] h-[1em] w-full",
      circle: "rounded-full aspect-square",
    },
  },
});
</script>

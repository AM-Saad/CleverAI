<template>
  <UAlert :color="tone" :variant="variant" :title="title" :description="description" :icon="icon" v-bind="$attrs">
    <template v-if="$slots.default" #description><slot /></template>
    <template v-if="$slots.actions" #actions><slot name="actions" /></template>
  </UAlert>
</template>

<script setup lang="ts">
/**
 * UiAlert — inline callout/banner for status messaging. Thin wrapper over the
 * themed `UAlert` with the canonical `tone` vocabulary.
 */
import type { Tone } from "./variants";

const { tone = "info", variant = "soft", title, description, icon } = defineProps<{
  tone?: Tone;
  variant?: "solid" | "outline" | "soft" | "subtle";
  title?: string;
  description?: string;
  icon?: string;
}>();
defineOptions({ inheritAttrs: false });
</script>

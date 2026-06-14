<template>
  <UTextarea v-model="model" :size="size" :rows="rows" :placeholder="placeholder" :disabled="disabled" :autoresize="autoresize" v-bind="$attrs" />
</template>

<script setup lang="ts">
/**
 * UiTextarea — multi-line text input. Thin wrapper over the themed `UTextarea`.
 */
import type { Size } from "./variants";

const model = defineModel<string | null>();
const { size = "md", rows = 3, placeholder, disabled = false, autoresize = false } = defineProps<{
  size?: Size;
  rows?: number;
  placeholder?: string;
  disabled?: boolean;
  autoresize?: boolean;
}>();
defineOptions({ inheritAttrs: false });
</script>

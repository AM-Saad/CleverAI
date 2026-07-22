<template>
  <UCheckbox
    v-model="model"
    :label="label"
    :description="description"
    :disabled="disabled"
    :required="required"
    :color="error ? 'error' : 'primary'"
    variant="list"
    :size="size"
    :indicator="indicator"
    :aria-invalid="error ? 'true' : undefined"
    v-bind="$attrs"
  />
</template>

<script setup lang="ts">
/**
 * UiCheckbox — boolean checkbox with optional label. Thin wrapper over `UCheckbox`.
 */
import type { ControlSize } from "./variants";

const model = defineModel<boolean | "indeterminate">();
const {
  label,
  description,
  size = "md",
  indicator = "start",
  disabled = false,
  required = false,
  error = false,
} = defineProps<{
  label?: string;
  description?: string;
  size?: ControlSize;
  indicator?: "start" | "end" | "hidden";
  disabled?: boolean;
  required?: boolean;
  error?: boolean | string;
}>();
defineOptions({ inheritAttrs: false });
</script>

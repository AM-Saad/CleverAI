<template>
  <USwitch
    v-model="model"
    :label="label"
    :description="description"
    :disabled="disabled"
    :required="required"
    :loading="loading"
    :color="error ? 'error' : 'primary'"
    :size="size"
    :checked-icon="checkedIcon"
    :unchecked-icon="uncheckedIcon"
    :aria-invalid="error ? 'true' : undefined"
    v-bind="$attrs"
  />
</template>

<script setup lang="ts">
/**
 * UiSwitch — boolean toggle. Thin wrapper over the themed `USwitch`. Replaces
 * the deprecated `UToggle`.
 */
import type { ControlSize } from "./variants";

const model = defineModel<boolean>();
const {
  label,
  description,
  size = "md",
  disabled = false,
  required = false,
  loading = false,
  checkedIcon,
  uncheckedIcon,
  error = false,
} = defineProps<{
  label?: string;
  description?: string;
  size?: ControlSize;
  disabled?: boolean;
  required?: boolean;
  loading?: boolean;
  checkedIcon?: string;
  uncheckedIcon?: string;
  error?: boolean | string;
}>();
defineOptions({ inheritAttrs: false });
</script>

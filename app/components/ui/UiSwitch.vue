<template>
  <USwitch
    v-model="model"
    :label="label"
    :description="description"
    :disabled="disabled"
    :required="required"
    :loading="loading"
    :color="resolvedColor"
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
import { computed } from "vue";
import type { Size, Tone } from "./variants";

const model = defineModel<boolean>();
const {
  label,
  description,
  tone = "primary",
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
  tone?: Tone;
  size?: Size;
  disabled?: boolean;
  required?: boolean;
  loading?: boolean;
  checkedIcon?: string;
  uncheckedIcon?: string;
  error?: boolean | string;
}>();
const resolvedColor = computed(() => error ? "error" : tone);
defineOptions({ inheritAttrs: false });
</script>

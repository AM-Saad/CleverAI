<template>
  <UCheckbox
    v-model="model"
    :label="label"
    :description="description"
    :disabled="disabled"
    :required="required"
    :color="resolvedColor"
    :variant="variant"
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
import { computed } from "vue";
import type { Size, Tone } from "./variants";

const model = defineModel<boolean | "indeterminate">();
const {
  label,
  description,
  tone = "primary",
  variant = "list",
  size = "md",
  indicator = "start",
  disabled = false,
  required = false,
  error = false,
} = defineProps<{
  label?: string;
  description?: string;
  tone?: Tone;
  variant?: "list" | "card";
  size?: Size;
  indicator?: "start" | "end" | "hidden";
  disabled?: boolean;
  required?: boolean;
  error?: boolean | string;
}>();
const resolvedColor = computed(() => error ? "error" : tone);
defineOptions({ inheritAttrs: false });
</script>

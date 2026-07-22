<template>
  <UTextarea
    v-model="model"
    :size="size"
    :rows="rows"
    :maxrows="maxrows"
    :placeholder="placeholder"
    :disabled="disabled"
    :readonly="readonly"
    :required="required"
    :autoresize="autoresize"
    :color="error ? 'error' : 'primary'"
    variant="outline"
    :highlight="Boolean(error)"
    :loading="loading"
    :aria-invalid="error ? 'true' : undefined"
    v-bind="$attrs"
  />
</template>

<script setup lang="ts">
/**
 * UiTextarea — multi-line text input. Thin wrapper over the themed `UTextarea`.
 */
import type { ControlSize } from "./variants";

const model = defineModel<string | null>();
const {
  size = "md",
  rows = 3,
  maxrows,
  placeholder,
  disabled = false,
  readonly = false,
  required = false,
  autoresize = false,
  loading = false,
  error = false,
} = defineProps<{
  size?: ControlSize;
  rows?: number;
  maxrows?: number;
  placeholder?: string;
  disabled?: boolean;
  readonly?: boolean;
  required?: boolean;
  autoresize?: boolean;
  loading?: boolean;
  error?: boolean | string;
}>();
defineOptions({ inheritAttrs: false });
</script>

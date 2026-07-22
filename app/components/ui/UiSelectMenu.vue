<template>
  <USelectMenu
    v-model="model"
    :size="size"
    :placeholder="placeholder"
    :disabled="disabled"
    :required="required"
    :color="error ? 'error' : 'primary'"
    variant="outline"
    :highlight="Boolean(error)"
    :loading="loading"
    :multiple="multiple"
    :aria-invalid="error ? 'true' : undefined"
    v-bind="$attrs"
  >
    <template v-for="(_, name) in $slots" #[name]="slotProps">
      <slot :name="name" v-bind="slotProps ?? {}" />
    </template>
  </USelectMenu>
</template>

<script setup lang="ts">
/**
 * UiSelectMenu — searchable/richer choice combobox (vs. the simpler
 * `UiSelect`). Thin wrapper over the themed `USelectMenu`.
 */
import type { ControlSize } from "./variants";

const model = defineModel<unknown>();
const {
  size = "md",
  placeholder,
  disabled = false,
  required = false,
  loading = false,
  multiple = false,
  error = false,
} = defineProps<{
  size?: ControlSize;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  loading?: boolean;
  multiple?: boolean;
  error?: boolean | string;
}>();
defineOptions({ inheritAttrs: false });
</script>

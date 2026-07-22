<template>
  <USelect
    v-model="model"
    :items="items"
    :value-key="valueKey"
    :label-key="labelKey"
    :size="size"
    :placeholder="placeholder"
    :disabled="disabled"
    :required="required"
    :color="error ? 'error' : 'primary'"
    variant="outline"
    :highlight="Boolean(error)"
    :loading="loading"
    :multiple="multiple"
    :content="content"
    :aria-invalid="error ? 'true' : undefined"
    v-bind="$attrs"
  >
    <template v-for="(_, name) in $slots" #[name]="slotProps">
      <slot :name="name" v-bind="slotProps ?? {}" />
    </template>
  </USelect>
</template>

<script setup lang="ts">
/**
 * UiSelect — single-choice dropdown. Thin wrapper over the themed `USelect`.
 */
import type { ControlSize } from "./variants";

const model = defineModel<unknown>();
const {
  items = [],
  valueKey,
  labelKey,
  size = "md",
  placeholder,
  disabled = false,
  required = false,
  loading = false,
  multiple = false,
  error = false,
  content,
} = defineProps<{
  items?: readonly unknown[];
  valueKey?: string;
  labelKey?: string;
  size?: ControlSize;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  loading?: boolean;
  multiple?: boolean;
  error?: boolean | string;
  content?: Record<string, unknown>;
}>();
defineOptions({ inheritAttrs: false });
</script>

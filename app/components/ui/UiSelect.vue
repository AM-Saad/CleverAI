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
    :color="resolvedColor"
    :variant="variant"
    :highlight="highlight || Boolean(error)"
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
import { computed } from "vue";
import type { Size, Tone } from "./variants";

type FieldVariant = "outline" | "soft" | "subtle" | "ghost" | "none";

const model = defineModel<unknown>();
const {
  items = [],
  valueKey,
  labelKey,
  size = "md",
  placeholder,
  tone = "primary",
  variant = "outline",
  disabled = false,
  required = false,
  highlight = false,
  loading = false,
  multiple = false,
  error = false,
  content,
} = defineProps<{
  items?: readonly unknown[];
  valueKey?: string;
  labelKey?: string;
  size?: Size;
  placeholder?: string;
  tone?: Tone;
  variant?: FieldVariant;
  disabled?: boolean;
  required?: boolean;
  highlight?: boolean;
  loading?: boolean;
  multiple?: boolean;
  error?: boolean | string;
  content?: Record<string, unknown>;
}>();
const resolvedColor = computed(() => error ? "error" : tone);
defineOptions({ inheritAttrs: false });
</script>

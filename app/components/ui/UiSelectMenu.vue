<template>
  <USelectMenu
    v-model="model"
    :size="size"
    :placeholder="placeholder"
    :disabled="disabled"
    :color="resolvedColor"
    :variant="variant"
    :highlight="highlight || Boolean(error)"
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
import { computed } from "vue";
import type { Size, Tone } from "./variants";

type FieldVariant = "outline" | "soft" | "subtle" | "ghost" | "none";

const model = defineModel<unknown>();
const {
  size = "md",
  placeholder,
  tone = "primary",
  variant = "outline",
  disabled = false,
  highlight = false,
  loading = false,
  multiple = false,
  error = false,
} = defineProps<{
  size?: Size;
  placeholder?: string;
  tone?: Tone;
  variant?: FieldVariant;
  disabled?: boolean;
  highlight?: boolean;
  loading?: boolean;
  multiple?: boolean;
  error?: boolean | string;
}>();
const resolvedColor = computed(() => (error ? "error" : tone));
defineOptions({ inheritAttrs: false });
</script>

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
    :color="resolvedColor"
    :variant="variant"
    :highlight="highlight || Boolean(error)"
    :loading="loading"
    :aria-invalid="error ? 'true' : undefined"
    v-bind="$attrs"
  />
</template>

<script setup lang="ts">
/**
 * UiTextarea — multi-line text input. Thin wrapper over the themed `UTextarea`.
 */
import { computed } from "vue";
import type { Size, Tone } from "./variants";

type FieldVariant = "outline" | "soft" | "subtle" | "ghost" | "none";

const model = defineModel<string | null>();
const {
  size = "md",
  rows = 3,
  maxrows,
  placeholder,
  tone = "primary",
  variant = "outline",
  disabled = false,
  readonly = false,
  required = false,
  autoresize = false,
  highlight = false,
  loading = false,
  error = false,
} = defineProps<{
  size?: Size;
  rows?: number;
  maxrows?: number;
  placeholder?: string;
  tone?: Tone;
  variant?: FieldVariant;
  disabled?: boolean;
  readonly?: boolean;
  required?: boolean;
  autoresize?: boolean;
  highlight?: boolean;
  loading?: boolean;
  error?: boolean | string;
}>();
const resolvedColor = computed(() => error ? "error" : tone);
defineOptions({ inheritAttrs: false });
</script>

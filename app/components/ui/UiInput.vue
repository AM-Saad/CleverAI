<template>
  <UInput
    :model-value="model"
    :size="size"
    :icon="icon"
    :type="type"
    :placeholder="placeholder"
    :disabled="disabled"
    :readonly="readonly"
    :required="required"
    :color="resolvedColor"
    :variant="variant"
    :highlight="highlight || Boolean(error)"
    :loading="loading"
    :aria-invalid="error ? 'true' : undefined"
    v-bind="$attrs"
    @update:model-value="updateModel"
  >
    <template v-for="(_, name) in $slots" #[name]="slotProps">
      <slot :name="name" v-bind="slotProps ?? {}" />
    </template>
  </UInput>
</template>

<script setup lang="ts">
/**
 * UiInput — single-line text input. Thin wrapper over the themed Nuxt UI
 * `UInput` (ring/focus/radius set in app.config.ts). Feature code uses this.
 */
import { computed } from "vue";
import type { Size, Tone } from "./variants";

type FieldVariant = "outline" | "soft" | "subtle" | "ghost" | "none";

const model = defineModel<string | number | null>();
const {
  size = "md",
  icon,
  type = "text",
  placeholder,
  tone = "primary",
  variant = "outline",
  disabled = false,
  readonly = false,
  required = false,
  highlight = false,
  loading = false,
  error = false,
} = defineProps<{
  size?: Size;
  icon?: string;
  type?: string;
  placeholder?: string;
  tone?: Tone;
  variant?: FieldVariant;
  disabled?: boolean;
  readonly?: boolean;
  required?: boolean;
  highlight?: boolean;
  loading?: boolean;
  error?: boolean | string;
}>();
const resolvedColor = computed(() => (error ? "error" : tone));

function updateModel(value: string | number | null | undefined) {
  model.value = value ?? null;
}

defineOptions({ inheritAttrs: false });
</script>

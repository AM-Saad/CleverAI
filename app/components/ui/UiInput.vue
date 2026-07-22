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
    :color="error ? 'error' : 'primary'"
    variant="outline"
    :highlight="Boolean(error)"
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
import type { ControlSize } from "./variants";

const model = defineModel<string | number | null>();
const {
  size = "md",
  icon,
  type = "text",
  placeholder,
  disabled = false,
  readonly = false,
  required = false,
  loading = false,
  error = false,
} = defineProps<{
  size?: ControlSize;
  icon?: string;
  type?: string;
  placeholder?: string;
  disabled?: boolean;
  readonly?: boolean;
  required?: boolean;
  loading?: boolean;
  error?: boolean | string;
}>();
function updateModel(value: string | number | null | undefined) {
  model.value = value ?? null;
}

defineOptions({ inheritAttrs: false });
</script>

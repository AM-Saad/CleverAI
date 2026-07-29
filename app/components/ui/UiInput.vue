<template>
  <UInput
    :model-value="model"
    :size="size"
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
    <template #leading v-if="props.icon && !$slots.leading">
      <UiIcon :name="props.icon" class="shrink-0" />
    </template>
    <template v-for="(_, name) in $slots" #[name]="slotProps">
      <slot :name="name" v-bind="slotProps ?? {}" />
    </template>
  </UInput>
</template>

<script setup lang="ts">
/**
 * UiInput — single-line text input wrapper. Intercepts icon prop to route
 * through UiIcon and AppIcon, ensuring 100% single-source local SVG icon rendering.
 */
import type { ControlSize } from "./variants";

const model = defineModel<string | number | null>();
const props = withDefaults(
  defineProps<{
    size?: ControlSize;
    icon?: string;
    type?: string;
    placeholder?: string;
    disabled?: boolean;
    readonly?: boolean;
    required?: boolean;
    loading?: boolean;
    error?: boolean | string;
  }>(),
  {
    size: "md",
    type: "text",
    disabled: false,
    readonly: false,
    required: false,
    loading: false,
    error: false,
  }
);

function updateModel(value: string | number | null | undefined) {
  model.value = value ?? null;
}

defineOptions({ inheritAttrs: false });
</script>

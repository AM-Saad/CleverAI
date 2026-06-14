<template>
  <USelect
    v-model="model"
    :items="items"
    :value-key="valueKey"
    :label-key="labelKey"
    :size="size"
    :placeholder="placeholder"
    :disabled="disabled"
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
import type { Size } from "./variants";

const model = defineModel<unknown>();
const {
  items = [],
  valueKey,
  labelKey,
  size = "md",
  placeholder,
  disabled = false,
} = defineProps<{
  items?: unknown[];
  valueKey?: string;
  labelKey?: string;
  size?: Size;
  placeholder?: string;
  disabled?: boolean;
}>();
defineOptions({ inheritAttrs: false });
</script>

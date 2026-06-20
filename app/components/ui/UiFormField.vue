<template>
  <UFormField
    :label="label"
    :description="description"
    :hint="hint"
    :error="error"
    :required="required"
    :name="name"
    v-bind="$attrs"
  >
    <template #default="{ error: fieldError }">
      <slot :error="fieldError" />
    </template>
    <template v-if="$slots.label" #label="slotProps"><slot name="label" v-bind="slotProps" /></template>
    <template v-if="$slots.description" #description="slotProps"><slot name="description" v-bind="slotProps" /></template>
    <template v-if="$slots.hint" #hint="slotProps"><slot name="hint" v-bind="slotProps" /></template>
    <template v-if="$slots.error" #error="slotProps"><slot name="error" v-bind="slotProps" /></template>
    <template v-if="$slots.help" #help="slotProps"><slot name="help" v-bind="slotProps" /></template>
  </UFormField>
</template>

<script setup lang="ts">
/**
 * UiFormField — label + description/hint + error wrapper around a form control
 * (`UiInput`/`UiTextarea`/`UiSelect`/...). Thin wrapper over the themed
 * `UFormField`; replaces the deprecated `UFormGroup` and the legacy
 * `InputField` component. Error text is tokenized via the theme.
 */
const { label, description, hint, error, required = false, name } = defineProps<{
  label?: string;
  description?: string;
  hint?: string;
  /** Error message (string) or boolean error state. */
  error?: string | boolean;
  required?: boolean;
  name?: string;
}>();
defineOptions({ inheritAttrs: false });
</script>

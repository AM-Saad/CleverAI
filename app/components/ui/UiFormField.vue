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
    <slot />
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

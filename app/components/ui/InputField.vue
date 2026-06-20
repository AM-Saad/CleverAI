<template>
  <div
    :class="[
      'form-group relative h-14 min-w-full overflow-hidden rounded-[var(--radius-md)] bg-surface ring-1 ring-inset ring-secondary has-focus-within:ring-2 has-focus-within:ring-inset has-focus-within:ring-[var(--ds-focus-outline-color)]',
      error && 'ring-error',
      disabled && 'cursor-not-allowed opacity-60',
      props.styles?.inputField,
    ]"
  >
    <input
      :id="props.id"
      v-model="model"
      :type="props.type"
      :name="props.name"
      :class="[
        'peer h-full w-full bg-transparent p-3 text-content-on-surface outline-none focus:pt-8',
        model && 'pt-8',
        props.styles?.input,
      ]"
      :tabindex="props.tabindex"
      placeholder=""
      :autocomplete="props.autocomplete"
      :pattern="props.pattern"
      :title="props.title"
      :disabled="disabled"
      :readonly="readonly"
      :required="required"
      :aria-invalid="error ? 'true' : undefined"
    />
    <label
      :for="props.id"
      :class="[
        'pointer-events-none absolute left-2 text-sm text-content-secondary transition-all duration-[var(--duration-fast)] ease-[var(--ease-standard)]',
        model ? 'top-2 text-xs' : 'top-4 peer-focus:top-2 peer-focus:text-xs',
        error && 'text-error-text',
        props.styles?.label,
      ]"
    >
      {{ label }}
    </label>
  </div>
</template>

<script setup lang="ts">
type InputStyles = {
  inputField?: string;
  input?: string;
  label?: string;
};
interface InputFieldProps {
  id: string;
  label: string;
  type?: string;
  title?: string;
  name?: string;
  pattern?: string | undefined;
  tabindex?: string | number;
  autocomplete?: string;
  disabled?: boolean;
  readonly?: boolean;
  required?: boolean;
  error?: boolean | string;
  styles?: InputStyles;
}
const model = defineModel({ type: String, required: true });

const props = withDefaults(defineProps<InputFieldProps>(), {
  id: "id",
  label: "label",
  type: "text",
  title: "title",
  name: "name",
  pattern: undefined,
  tabindex: 1,
  autocomplete: "off",
  disabled: false,
  readonly: false,
  required: false,
  error: false,
  styles: undefined,
});
</script>

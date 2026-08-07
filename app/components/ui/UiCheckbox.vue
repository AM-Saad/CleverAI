<template>
  <UCheckbox v-model="model" :label="label" :description="description" :disabled="disabled" :required="required"
    :color="error ? 'error' : 'primary'" variant="list" :size="size" :indicator="indicator"
    :aria-invalid="error ? 'true' : undefined" v-bind="$attrs" :ui="overdue ? overdueUi : undefined" />
</template>

<script setup lang="ts">
/**
 * UiCheckbox — boolean checkbox with optional label. Thin wrapper over `UCheckbox`.
 */
import type { ControlSize } from "./variants";

const model = defineModel<boolean | "indeterminate">();
const {
  label,
  description,
  size = "md",
  indicator = "start",
  disabled = false,
  required = false,
  error = false,
  overdue = false,
} = defineProps<{
  label?: string;
  description?: string;
  size?: ControlSize;
  indicator?: "start" | "end" | "hidden";
  disabled?: boolean;
  required?: boolean;
  error?: boolean | string;
  /**
   * Past-due state: while unchecked, the box takes an error ring/tint and shows
   * a caution triangle. Purely a highlight — it leaves the checked appearance,
   * `color`, and validity (`error`/`aria-invalid`) alone.
   */
  overdue?: boolean;
}>();
defineOptions({ inheritAttrs: false });

/* Ring recolour rides on the unchecked variant so a checked box keeps its
   normal fill; the caution triangle itself comes from the scoped CSS below. */
const overdueUi = {
  base: "ui-checkbox__box--overdue data-[state=unchecked]:ring-error",
};
</script>

<style scoped>
/*
 * The box is a reka-ui <button> that only mounts its indicator (and therefore
 * any icon) while checked, and takes no children we can pass — so the caution
 * mark on an *unchecked* overdue box has to be painted onto the box itself
 * rather than rendered as a <UiIcon>. Masking the lucide `triangle-alert`
 * artwork keeps it a single token-coloured shape that follows the theme.
 */
:deep(.ui-checkbox__box--overdue[data-state="unchecked"]) {
  position: relative;
  background-color: color-mix(in srgb, var(--color-error) 12%, transparent);
}

:deep(.ui-checkbox__box--overdue[data-state="unchecked"])::before {
  content: "";
  position: absolute;
  inset: 0;
  /* background-color: var(--color-error); */
  mask-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3'/%3E%3Cpath d='M12 9v4'/%3E%3Cpath d='M12 17h.01'/%3E%3C/svg%3E");
  mask-repeat: no-repeat;
  mask-position: center;
  mask-size: 78%;
  -webkit-mask-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3'/%3E%3Cpath d='M12 9v4'/%3E%3Cpath d='M12 17h.01'/%3E%3C/svg%3E");
  -webkit-mask-repeat: no-repeat;
  -webkit-mask-position: center;
  -webkit-mask-size: 78%;
}
</style>

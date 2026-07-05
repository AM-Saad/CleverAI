<template>
  <div class="ui-settings-stepper">
    <button
      type="button"
      :aria-label="decrementLabel"
      :disabled="disabled || value <= min"
      class="ui-settings-stepper__button"
      @click="update(value - step)"
    >
      <UiIcon name="i-lucide-minus" class="h-4 w-4" />
    </button>
    <span class="ui-settings-stepper__value">{{ value }}</span>
    <button
      type="button"
      :aria-label="incrementLabel"
      :disabled="disabled || value >= max"
      class="ui-settings-stepper__button"
      @click="update(value + step)"
    >
      <UiIcon name="i-lucide-plus" class="h-4 w-4" />
    </button>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";

const model = defineModel<number>({ required: true });
const props = withDefaults(
  defineProps<{
    min?: number;
    max?: number;
    step?: number;
    disabled?: boolean;
    decrementLabel?: string;
    incrementLabel?: string;
  }>(),
  {
    min: 1,
    max: 100,
    step: 1,
    disabled: false,
    decrementLabel: "Decrease",
    incrementLabel: "Increase",
  },
);

const value = computed(() => model.value ?? props.min);

function update(next: number) {
  model.value = Math.min(props.max, Math.max(props.min, next));
}
</script>

<style scoped>
.ui-settings-stepper {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.ui-settings-stepper__button {
  display: grid;
  place-items: center;
  width: 32px;
  height: 32px;
  border-radius: var(--radius-full);
  background: var(--color-surface-subtle);
  color: var(--color-content-on-surface-strong);
  transition:
    background-color var(--duration-fast) var(--ease-standard),
    color var(--duration-fast) var(--ease-standard),
    transform var(--duration-fast) var(--ease-standard);
}

.ui-settings-stepper__button:hover:not(:disabled) {
  background: var(--color-surface-strong);
}

.ui-settings-stepper__button:active:not(:disabled) {
  transform: scale(0.96);
}

.ui-settings-stepper__button:focus-visible {
  outline: 2px solid var(--ds-focus-outline-color);
  outline-offset: 2px;
}

.ui-settings-stepper__button:disabled {
  cursor: not-allowed;
  opacity: 0.45;
}

.ui-settings-stepper__value {
  min-width: 24px;
  text-align: center;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  color: var(--color-content-on-surface-strong);
}
</style>

<template>
  <UiButton
    v-if="!unstyled"
    v-bind="passthroughAttrs"
    :class="rootClass"
    :style="rootStyle"
    :tone="tone"
    :variant="variant"
    :size="size"
    :icon="effectiveIcon"
    :leading-icon="effectiveLeadingIcon"
    :trailing-icon="trailingIcon"
    :loading="loading"
    :disabled="disabled"
    :block="block"
    :square="square"
    :aria-label="computedAriaLabel"
    :title="computedTitle"
    :data-confirm-state="isArmed ? 'armed' : 'idle'"
    @click="onTrigger"
    @keydown.esc.stop.prevent="cancel()"
  >
    <slot v-if="!hideLabel || $slots.default" :armed="isArmed" :label="currentLabel">
      <template v-if="!hideLabel">{{ currentLabel }}</template>
    </slot>
    <span v-if="isArmed" class="sr-only" aria-live="polite">{{ armedAnnouncement }}</span>
  </UiButton>

  <button
    v-else
    v-bind="passthroughAttrs"
    type="button"
    :class="rootClass"
    :style="rootStyle"
    :disabled="disabled || loading"
    :aria-label="computedAriaLabel"
    :title="computedTitle"
    :data-confirm-state="isArmed ? 'armed' : 'idle'"
    @click="onTrigger"
    @keydown.esc.stop.prevent="cancel()"
  >
    <slot v-if="!hideLabel || $slots.default" :armed="isArmed" :label="currentLabel">
      <template v-if="!hideLabel">{{ currentLabel }}</template>
    </slot>
    <span v-if="isArmed" class="sr-only" aria-live="polite">{{ armedAnnouncement }}</span>
  </button>
</template>

<script setup lang="ts">
/**
 * UiDoubleTapDeleteButton — destructive action guard.
 *
 * First activation arms the action and changes the accessible/visible label.
 * Second activation within the confirmation window emits `confirm`.
 *
 * Use `unstyled` when a feature owns bespoke row/button styling; otherwise this
 * composes UiButton and follows the design-system button state conventions.
 */
import { computed, useAttrs, type StyleValue } from "vue";
import type { ActionTone, ControlSize } from "./variants";
import { useDoubleTapConfirm } from "~/composables/shared/useDoubleTapConfirm";

defineOptions({ inheritAttrs: false });

const props = withDefaults(
  defineProps<{
    label?: string;
    armedLabel?: string;
    announcement?: string;
    confirmWindowMs?: number;
    resetKey?: string | number | boolean | null;
    disabled?: boolean;
    loading?: boolean;
    unstyled?: boolean;
    stopPropagation?: boolean;
    preventDefault?: boolean;
    tone?: ActionTone;
    variant?: "solid" | "soft" | "ghost" | "link";
    size?: ControlSize;
    icon?: string;
    armedIcon?: string;
    leadingIcon?: string;
    armedLeadingIcon?: string;
    trailingIcon?: string;
    block?: boolean;
    square?: boolean;
    title?: string;
    ariaLabel?: string;
    hideLabel?: boolean;
  }>(),
  {
    label: "Delete",
    armedLabel: "Tap again to delete",
    announcement: undefined,
    confirmWindowMs: undefined,
    resetKey: null,
    disabled: false,
    loading: false,
    unstyled: false,
    stopPropagation: false,
    preventDefault: false,
    tone: "error",
    variant: "ghost",
    size: "sm",
    icon: undefined,
    armedIcon: "i-lucide-alert-triangle",
    leadingIcon: undefined,
    armedLeadingIcon: undefined,
    trailingIcon: undefined,
    block: false,
    square: false,
    title: undefined,
    ariaLabel: undefined,
    hideLabel: false,
  },
);

const emit = defineEmits<{
  confirm: [];
  arm: [];
  cancel: [];
}>();

const attrs = useAttrs();

const { isArmed, trigger, cancel } = useDoubleTapConfirm({
  windowMs: () => props.confirmWindowMs,
  disabled: () => props.disabled,
  loading: () => props.loading,
  resetKey: () => props.resetKey,
  onArm: () => emit("arm"),
  onCancel: () => emit("cancel"),
  onConfirm: () => emit("confirm"),
});

const currentLabel = computed(() => (isArmed.value ? props.armedLabel : props.label));
const armedAnnouncement = computed(() => props.announcement ?? props.armedLabel);
const attrAriaLabel = computed(() =>
  typeof attrs["aria-label"] === "string" ? attrs["aria-label"] : undefined,
);
const attrTitle = computed(() => (typeof attrs.title === "string" ? attrs.title : undefined));
const computedAriaLabel = computed(() =>
  isArmed.value
    ? props.armedLabel
    : (props.ariaLabel ?? attrAriaLabel.value ?? currentLabel.value),
);
const computedTitle = computed(() =>
  isArmed.value
    ? props.armedLabel
    : (props.title ?? attrTitle.value ?? currentLabel.value),
);
const effectiveIcon = computed(() => (isArmed.value ? (props.armedIcon ?? props.icon) : props.icon));
const effectiveLeadingIcon = computed(() =>
  isArmed.value ? (props.armedLeadingIcon ?? props.leadingIcon) : props.leadingIcon,
);

const passthroughAttrs = computed(() => {
  const {
    class: _class,
    style: _style,
    "aria-label": _ariaLabel,
    title: _title,
    ...rest
  } = attrs;
  return rest;
});

const rootClass = computed(() => ["ui-doubletap-delete", attrs.class]);
const rootStyle = computed<StyleValue>(() => attrs.style as StyleValue);

async function onTrigger(event: MouseEvent) {
  if (props.preventDefault) event.preventDefault();
  if (props.stopPropagation) event.stopPropagation();
  await trigger();
}
</script>

<style scoped>
.ui-doubletap-delete {
  transition:
    background-color var(--duration-fast) var(--ease-standard),
    border-color var(--duration-fast) var(--ease-standard),
    color var(--duration-fast) var(--ease-standard),
    box-shadow var(--duration-fast) var(--ease-standard),
    transform var(--duration-fast) var(--ease-standard);
}

.ui-doubletap-delete[data-confirm-state="armed"] {
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--color-error) 62%, transparent);
}

.ui-doubletap-delete[data-confirm-state="armed"]:not(:disabled) {
  color: var(--color-error-text);
}
</style>

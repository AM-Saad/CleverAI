<template>
  <UiTooltip
    :text="title || ''"
    :disabled="!title"
    :delay-duration="200"
    :content="{ side: 'top', sideOffset: 6 }"
    :shortcuts="shortcuts"
  >
    <UiButton
      type="button"
      :tone="buttonTone"
      :variant="buttonVariant"
      size="xs"
      :aria-label="title || label"
      :disabled="disabled"
      :class="[
        active ? 'shadow-[var(--shadow-dropdown)]' : '',
        ($slots.default && !iconOnly) || label ? '' : 'h-8 w-8',
      ]"
      @click="emit('click', $event)"
    >
      <shared-icon
        v-if="icon"
        :name="icon"
        class="w-[18px] h-[18px] shrink-0"
      />
      <span v-if="label" :class="{ 'hidden sm:inline': hideLabelOnMobile }">{{
        label
      }}</span>
      <slot />
    </UiButton>
  </UiTooltip>
</template>

<script setup lang="ts">
import type { IconName } from "#imports";

const props = defineProps<{
  icon?: IconName;
  label?: string;
  title?: string;
  active?: boolean;
  disabled?: boolean;
  hideLabelOnMobile?: boolean;
  iconOnly?: boolean;
  variant?: "default" | "danger" | "primary";
  shortcuts?: string[];
}>();

const emit = defineEmits<{
  (e: "click", event: MouseEvent): void;
}>();

const buttonTone = computed(() => {
  if (props.variant === "danger") return "error";
  if (props.variant === "primary" || props.active) return "primary";
  return "neutral";
});

const buttonVariant = computed(() => {
  if (props.variant === "primary") return "solid";
  if (props.active) return "soft";
  return "ghost";
});
</script>

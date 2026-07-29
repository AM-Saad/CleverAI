<template>
  <UButton
    :color="tone"
    :variant="variant"
    :size="size"
    :loading="loading"
    :loading-auto="loadingAuto"
    :disabled="disabled"
    :active="active"
    :active-variant="activeVariant"
    :block="block"
    :square="square"
    v-bind="$attrs"
  >
    <template #leading v-if="computedLeading && !$slots.leading">
      <UiIcon :name="computedLeading" class="shrink-0" />
    </template>
    
    <template #trailing v-if="computedTrailing && !$slots.trailing">
      <UiIcon :name="computedTrailing" class="shrink-0" />
    </template>

    <!-- Forward every slot (default + named leading/trailing) so the wrapper is a drop-in for UButton -->
    <template v-for="(_, name) in $slots" #[name]="slotProps">
      <slot :name="name" v-bind="slotProps ?? {}" />
    </template>
  </UButton>
</template>

<script setup lang="ts">
/**
 * UiButton — design system button. Intercepts icon props to route through
 * UiIcon and AppIcon, ensuring 100% single-source local SVG icon rendering.
 */
import { computed } from "vue";
import type { ActionTone, ControlSize } from "./variants";

const props = withDefaults(
  defineProps<{
    tone?: ActionTone;
    variant?: "solid" | "soft" | "ghost" | "link";
    size?: ControlSize;
    icon?: string;
    leadingIcon?: string;
    trailingIcon?: string;
    loading?: boolean;
    loadingAuto?: boolean;
    disabled?: boolean;
    active?: boolean;
    activeVariant?: "solid" | "soft" | "ghost" | "link";
    block?: boolean;
    square?: boolean;
  }>(),
  {
    tone: "primary",
    variant: "solid",
    size: "md",
    loading: false,
    loadingAuto: false,
    disabled: false,
    block: false,
    square: false,
  }
);

const computedLeading = computed(() => props.leadingIcon || props.icon || null);
const computedTrailing = computed(() => props.trailingIcon || null);

defineOptions({ inheritAttrs: false });
</script>

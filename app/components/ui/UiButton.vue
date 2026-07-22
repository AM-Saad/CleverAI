<template>
  <UButton
    :color="tone"
    :variant="variant"
    :size="size"
    :icon="icon"
    :leading-icon="leadingIcon"
    :trailing-icon="trailingIcon"
    :loading="loading"
    :loading-auto="loadingAuto"
    :disabled="disabled"
    :active="active"
    :active-variant="activeVariant"
    :block="block"
    :square="square"
    v-bind="$attrs"
  >
    <!-- Forward every slot (default + named leading/trailing) so the wrapper is
         a drop-in for UButton. -->
    <template v-for="(_, name) in $slots" #[name]="slotProps">
      <slot :name="name" v-bind="slotProps ?? {}" />
    </template>
  </UButton>
</template>

<script setup lang="ts">
/**
 * UiButton — the design-system button. Thin wrapper over the themed Nuxt UI
 * `UButton` (see app/app.config.ts) exposing the canonical `tone`/`size`
 * vocabulary. Feature code should use this, not `UButton` directly.
 */
import type { ActionTone, ControlSize } from "./variants";

const {
  tone = "primary",
  variant = "solid",
  size = "md",
  icon,
  leadingIcon,
  trailingIcon,
  loading = false,
  loadingAuto = false,
  disabled = false,
  active,
  activeVariant,
  block = false,
  square = false,
} = defineProps<{
  /** Semantic color role. */
  tone?: ActionTone;
  /**
   * Emphasis level — the system uses a 4-variant ladder:
   * `solid` (primary) → `soft` (secondary) → `ghost` (tertiary) → `link` (inline).
   */
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
}>();

defineOptions({ inheritAttrs: false });
</script>

<template>
  <UButton
    :color="color"
    :variant="variant"
    :size="size"
    :icon="icon"
    :leading-icon="leadingIcon"
    :trailing-icon="trailingIcon"
    :loading="loading"
    :disabled="disabled"
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
import { computed } from "vue";
import type { Size, Tone } from "./variants";

const {
  tone = "primary",
  variant = "solid",
  size = "md",
  icon,
  leadingIcon,
  trailingIcon,
  loading = false,
  disabled = false,
  block = false,
  square = false,
} = defineProps<{
  /** Semantic color role. */
  tone?: Tone;
  /** Visual style. */
  variant?: "solid" | "outline" | "soft" | "subtle" | "ghost" | "link";
  size?: Size;
  icon?: string;
  leadingIcon?: string;
  trailingIcon?: string;
  loading?: boolean;
  disabled?: boolean;
  block?: boolean;
  square?: boolean;
}>();

defineOptions({ inheritAttrs: false });

// `tone` maps 1:1 to Nuxt UI color names (neutral is aliased to `secondary`
// in app.config.ts).
const color = computed(() => tone);
</script>

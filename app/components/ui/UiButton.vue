<template>
  <UButton
    :color="color"
    :variant="variant"
    :size="size"
    :icon="icon"
    :leading-icon="leadingIcon"
    :trailing-icon="trailingIcon"
    :loading="loading"
    :loading-auto="loadingAuto"
    :disabled="disabled"
    :active="active"
    :active-color="activeColor"
    :active-variant="activeVariant"
    :block="block"
    :square="square"
    :class="pill ? 'rounded-[var(--radius-full)]' : undefined"
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

type LegacyTone = Tone | "secondary";

const {
  tone = "primary",
  color: legacyColor,
  variant = "solid",
  size = "md",
  icon,
  leadingIcon,
  trailingIcon,
  loading = false,
  loadingAuto = false,
  disabled = false,
  active,
  activeColor,
  activeVariant,
  block = false,
  square = false,
  pill = false,
} = defineProps<{
  /** Semantic color role. */
  tone?: Tone;
  /** @deprecated Use `tone`. Kept as a migration bridge for legacy call sites. */
  color?: LegacyTone;
  /**
   * Emphasis level — the system uses a 4-variant ladder:
   * `solid` (primary) → `soft` (secondary) → `ghost` (tertiary) → `link` (inline).
   */
  variant?: "solid" | "soft" | "ghost" | "link";
  size?: Size;
  icon?: string;
  leadingIcon?: string;
  trailingIcon?: string;
  loading?: boolean;
  loadingAuto?: boolean;
  disabled?: boolean;
  active?: boolean;
  activeColor?: LegacyTone;
  activeVariant?: "solid" | "soft" | "ghost" | "link";
  block?: boolean;
  square?: boolean;
  /** Pill shape (full-radius) — used for CTAs in the mobile design. */
  pill?: boolean;
}>();

defineOptions({ inheritAttrs: false });

// `tone` maps 1:1 to Nuxt UI color names (neutral is aliased to `secondary`
// in app.config.ts).
const color = computed(() =>
  legacyColor === "secondary" ? "neutral" : (legacyColor ?? tone),
);
</script>

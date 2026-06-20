<template>
  <UBadge
    :color="color"
    :variant="variant"
    :size="size"
    :icon="icon"
    v-bind="$attrs"
  >
    <template v-for="(_, name) in $slots" #[name]="slotProps">
      <slot :name="name" v-bind="slotProps ?? {}" />
    </template>
  </UBadge>
</template>

<script setup lang="ts">
/**
 * UiBadge — status chips, counts, and tags. Thin wrapper over the themed Nuxt UI
 * `UBadge` with the canonical `tone` vocabulary. Pill shape (`rounded-full`) is
 * reserved for avatars/status dots — badges use the chip radius from the theme.
 */
import { computed } from "vue";
import type { Tone } from "./variants";

type LegacyTone = Tone | "secondary";

const {
  tone = "neutral",
  color: legacyColor,
  variant = "soft",
  size = "sm",
  icon,
} = defineProps<{
  /** Semantic color role. */
  tone?: Tone;
  /** @deprecated Use `tone`. Kept as a migration bridge for legacy call sites. */
  color?: LegacyTone;
  variant?: "solid" | "outline" | "soft" | "subtle";
  size?: "xs" | "sm" | "md" | "lg";
  icon?: string;
}>();

defineOptions({ inheritAttrs: false });

const color = computed(() =>
  legacyColor === "secondary" ? "neutral" : (legacyColor ?? tone),
);
</script>

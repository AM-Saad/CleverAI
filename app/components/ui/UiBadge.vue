<template>
  <UBadge
    :color="tone"
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
import type { SemanticTone } from "./variants";

const {
  tone = "neutral",
  variant = "soft",
  size = "sm",
  icon,
} = defineProps<{
  /** Semantic color role. */
  tone?: SemanticTone;
  variant?: "outline" | "soft" | "subtle";
  size?: "xs" | "sm" | "md" | "lg";
  icon?: string;
}>();

defineOptions({ inheritAttrs: false });
</script>

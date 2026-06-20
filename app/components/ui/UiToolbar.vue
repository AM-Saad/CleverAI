<template>
  <div :class="ui" role="toolbar" :aria-label="label">
    <slot />
  </div>
</template>

<script setup lang="ts">
/**
 * UiToolbar — canonical compact command row for board, notes, editor, and
 * import controls.
 */
import { computed } from "vue";
import { tv } from "./variants";

const {
  label = "Toolbar",
  density = "compact",
  wrap = true,
  className = "",
} = defineProps<{
  label?: string;
  density?: "compact" | "comfortable";
  wrap?: boolean;
  className?: string;
}>();

const toolbar = tv({
  base: "flex items-center border border-secondary bg-surface-subtle",
  variants: {
    density: {
      compact: "gap-1 rounded-[var(--radius-lg)] p-1",
      comfortable: "gap-2 rounded-[var(--radius-xl)] p-2",
    },
    wrap: {
      true: "flex-wrap",
      false: "flex-nowrap overflow-x-auto",
    },
  },
});

const ui = computed(() => toolbar({ density, wrap, class: className }));
</script>

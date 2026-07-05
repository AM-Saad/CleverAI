<template>
  <span
    :class="ui.root({ class: className })"
    :style="indicatorStyle"
    :role="label ? 'img' : undefined"
    :aria-hidden="label ? undefined : 'true'"
    :aria-label="label || undefined"
    :title="label || undefined"
  />
</template>

<script setup lang="ts">
import { computed } from "vue";
import { tv } from "./variants";

const props = withDefaults(
  defineProps<{
    color?: string;
    label?: string;
    size?: "md" | "sm";
    hollow?: boolean;
    className?: string;
  }>(),
  {
    color: "currentColor",
    label: "",
    size: "md",
    hollow: false,
    className: "",
  },
);

const indicator = tv({
  slots: {
    root: "inline-block shrink-0 rounded-[var(--radius-full)] border",
  },
  variants: {
    size: {
      md: { root: "h-2 w-2" },
      sm: { root: "h-1.5 w-1.5" },
    },
    hollow: {
      true: { root: "bg-transparent!" },
      false: {},
    },
  },
});

const ui = computed(() =>
  indicator({ size: props.size, hollow: props.hollow }),
);
const indicatorStyle = computed(() => ({
  background: props.hollow ? "transparent" : props.color,
  borderColor: props.color,
}));
</script>

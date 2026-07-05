<template>
  <button
    v-if="button"
    type="button"
    :class="ui.root({ class: className })"
    :aria-label="resolvedLabel"
    :title="resolvedLabel"
    :disabled="disabled"
    @click.stop="emit('click', $event)"
  >
    <UiIcon :name="name" :class="ui.icon()" aria-hidden="true" />
  </button>
  <span v-else :class="ui.root({ class: className })" aria-hidden="true">
    <UiIcon :name="name" :class="ui.icon()" />
  </span>
</template>

<script setup lang="ts">
import { computed } from "vue";
import {
  disabledState,
  focusRing,
  interactiveTransition,
  pressedScale,
  tv,
} from "./variants";

const emit = defineEmits<{
  click: [event: MouseEvent];
}>();

const props = withDefaults(
  defineProps<{
    name: string;
    label?: string;
    button?: boolean;
    disabled?: boolean;
    size?: "md" | "sm";
    className?: string;
  }>(),
  {
    label: "",
    button: false,
    disabled: false,
    size: "md",
    className: "",
  },
);

const resolvedLabel = computed(() => props.label || props.name);

const pillIcon = tv({
  slots: {
    root: "inline-grid shrink-0 place-items-center rounded-[var(--radius-full)] text-current",
    icon: "shrink-0",
  },
  variants: {
    size: {
      md: { root: "h-5 w-5", icon: "h-4 w-4" },
      sm: { root: "h-4 w-4", icon: "h-3 w-3" },
    },
    button: {
      // Visual size stays compact (pill-scale), but the tap target is expanded
      // to the WCAG 2.2 AA minimum (24px, --target-min) via an invisible
      // pseudo-element rather than growing the icon itself.
      true: {
        root: [
          "relative cursor-pointer hover:bg-current/10 before:absolute before:inset-[-4px] before:content-['']",
          interactiveTransition,
          pressedScale,
          focusRing,
          disabledState,
        ].join(" "),
      },
      false: {},
    },
  },
});

const ui = computed(() => pillIcon({ size: props.size, button: props.button }));
</script>

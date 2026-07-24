<template>
  <div
    class="inline-flex items-center gap-0.5 rounded-[var(--radius-lg)] border border-secondary p-0.5"
    role="radiogroup"
    aria-label="Color theme"
  >
    <button
      v-for="opt in options"
      :key="opt.value"
      type="button"
      role="radio"
      :aria-checked="colorMode.preference === opt.value"
      :aria-label="opt.label"
      :title="opt.label"
      :class="[
        'inline-flex items-center justify-center w-7 h-7 rounded-[var(--radius-md)] cursor-pointer',
        interactiveTransition,
        pressedScale,
        focusRing,
        colorMode.preference === opt.value
          ? 'bg-primary text-on-primary scale-110 aria-checked:focus-visible:outline-[var(--ds-focus-outline-on-primary)]!'
          : 'text-content-secondary hover:bg-surface-strong',
      ]"
      @click="colorMode.preference = opt.value"
    >
      <Icon :name="opt.icon" class="w-4 h-4" />
    </button>
  </div>
</template>

<script setup lang="ts">
import { focusRing, interactiveTransition, pressedScale } from "./variants";

/**
 * UiColorModeToggle — three-way Light / Dark / System theme switch. Drives the
 * global color mode (adds `.dark` to <html>, which flips the design tokens).
 */
const colorMode = useColorMode();

const options = [
  { value: "light", label: "Light", icon: "i-lucide-sun" },
  { value: "dark", label: "Dark", icon: "i-lucide-moon" },
  { value: "system", label: "System", icon: "i-lucide-monitor" },
] as const;
</script>

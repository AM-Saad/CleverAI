<template>
  <UInput v-model="model" :size="size" :icon="icon" :type="type" :placeholder="placeholder" :disabled="disabled" v-bind="$attrs">
    <template v-for="(_, name) in $slots" #[name]="slotProps">
      <slot :name="name" v-bind="slotProps ?? {}" />
    </template>
  </UInput>
</template>

<script setup lang="ts">
/**
 * UiInput — single-line text input. Thin wrapper over the themed Nuxt UI
 * `UInput` (ring/focus/radius set in app.config.ts). Feature code uses this.
 */
import type { Size } from "./variants";

const model = defineModel<string | number | null>();
const { size = "md", icon, type = "text", placeholder, disabled = false } = defineProps<{
  size?: Size;
  icon?: string;
  type?: string;
  placeholder?: string;
  disabled?: boolean;
}>();
defineOptions({ inheritAttrs: false });
</script>

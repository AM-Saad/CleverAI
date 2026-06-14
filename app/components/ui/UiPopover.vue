<template>
  <UPopover :mode="mode" v-bind="$attrs">
    <slot />
    <template #content>
      <slot name="content" />
    </template>
  </UPopover>
</template>

<script setup lang="ts">
/**
 * UiPopover — floating panel anchored to a trigger (default slot); panel markup
 * goes in the `content` slot. Thin wrapper over the themed `UPopover`.
 */
const { mode = "click" } = defineProps<{
  mode?: "click" | "hover";
}>();
defineOptions({ inheritAttrs: false });
</script>

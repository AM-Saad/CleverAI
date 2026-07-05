<template>
  <UContextMenu :items="items" v-bind="$attrs">
    <slot />
  </UContextMenu>
</template>

<script setup lang="ts">
/**
 * UiContextMenu — right-click/long-press menu anchored to its default-slot
 * content. Thin wrapper over the themed `UContextMenu`.
 */
type ContextMenuItem = Record<string, unknown> & {
  label?: string;
  icon?: string;
};

defineProps<{
  items: ContextMenuItem[] | ContextMenuItem[][];
}>();
defineOptions({ inheritAttrs: false });
</script>

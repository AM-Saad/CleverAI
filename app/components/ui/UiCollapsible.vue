<template>
  <UCollapsible v-bind="$attrs">
    <slot />
    <template #content>
      <slot name="content" />
    </template>
  </UCollapsible>
</template>

<script setup lang="ts">
/**
 * UiCollapsible — expand/collapse region; default slot is the trigger,
 * `#content` slot is the collapsible body. Thin wrapper over the themed
 * `UCollapsible`.
 */
defineOptions({ inheritAttrs: false });
</script>

<template>
  <UTooltip :text="text" :delay-duration="delayDuration" v-bind="$attrs">
    <slot />
  </UTooltip>
</template>

<script setup lang="ts">
/**
 * UiTooltip — hover/focus tooltip wrapping a trigger in the default slot.
 * Thin wrapper over the themed `UTooltip`.
 */
const { text, delayDuration = 200 } = defineProps<{
  text?: string;
  delayDuration?: number;
}>();
defineOptions({ inheritAttrs: false });
</script>

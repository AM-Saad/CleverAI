<template>
  <div :class="cn(
    ' relative min-w-full h-full rounded-[var(--radius-2xl)] transition-transform duration-500 will-change-transform cursor-pointer text-dark [transform-style:preserve-3d] flex',
  )
    " :style="{ transform: wrapperTransform }" @click="flipped = !flipped">

    <!-- Front -->
    <div
      class="absolute top-0 size-full overflow-hidden rounded-[var(--radius-2xl)]  bg-surface-subtle  [backface-visibility:hidden] p-4">
      <slot name="front" />
    </div>

    <!-- Back -->
    <div :class="cn(
      'absolute top-0 h-full w-full overflow-hidden flex flex-col justify-between rounded-[var(--radius-2xl)] bg-background p-4 text-content-on-background [backface-visibility:hidden]',
    )
      " :style="{ transform: backTransform }">
      <slot name="back" />
    </div>

  </div>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";

interface FlipCardProps {
  rotate?: "x" | "y";
  class?: string;
  front?: string;
  back?: string;
}

const props = withDefaults(defineProps<FlipCardProps>(), {
  rotate: "y",
});
const flipped = ref(false);

const axis = computed(() => (props.rotate === "x" ? "X" : "Y"));
const wrapperTransform = computed(
  () => `rotate${axis.value}(${flipped.value ? 180 : 0}deg)`,
);
const backTransform = computed(() => `rotate${axis.value}(180deg)`);
</script>

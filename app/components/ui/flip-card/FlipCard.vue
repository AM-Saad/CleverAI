<template>
  <div
    :class="
      cn(
        'h-44 flex-1 w-full select-none [perspective:1000px] mb-4 md:mb-0',
        props.class,
      )
    "
  >
    <div
      :class="
        cn(
          'block relative min-w-full h-full rounded-2xl transition-transform duration-500 will-change-transform cursor-pointer text-dark [transform-style:preserve-3d]',
        )
      "
      :style="{ transform: wrapperTransform }"
      @click="flipped = !flipped"
    >
      <!-- Front -->
      <div
        class="absolute size-full overflow-hidden rounded-2xl border border-muted dark:border-light [backface-visibility:hidden] bg-foreground p-4"
      >
        <slot name="front" />
      </div>

      <!-- Back -->
      <div
        :class="
          cn(
            'absolute h-full w-full overflow-hidden rounded-2xl border border-muted bg-light dark:bg-dark p-4 text-dark [backface-visibility:hidden]',
          )
        "
        :style="{ transform: backTransform }"
      >
        <slot name="back" />
      </div>
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

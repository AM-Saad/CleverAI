<template>
  <Motion
    as="div"
    :class="cn('relative', props.class)"
    initial="hidden"
    animate="visible"
    :variants="containerVariants"
    :transition="finalTransition"
  >
    <span
      v-for="(letter, index) in letters"
      :key="`${letter}-${index}`"
      class="absolute left-1/2 top-1/2"
      :variants="itemVariants"
      :style="{
        '--index': index,
        '--total': letters.length,
        '--radius': radius,
        transform: `
                  translate(-50%, -50%)
                  rotate(calc(360deg / var(--total) * var(--index)))
                  translateY(calc(var(--radius, 5) * -1ch))
                `,
        transformOrigin: 'center',
      }"
    >
      {{ letter }}
    </span>
  </Motion>
</template>

<script lang="ts" setup>
import { Motion } from "motion-v";

const BASE_TRANSITION = {
  repeat: Infinity,
  ease: "linear",
} as const;

const BASE_ITEM_VARIANTS = {
  hidden: { opacity: 1 },
  visible: { opacity: 1 },
};

interface CircularTextProps {
  text: string;
  duration?: number;
  class?: string;
  reverse?: boolean;
  radius?: number;
  transition?: Record<string, unknown>;
  variants?: {
    container?: Record<string, unknown>;
    item?: Record<string, unknown>;
  };
}

const props = withDefaults(defineProps<CircularTextProps>(), {
  duration: 10,
  radius: 5,
});

const letters = computed(() => {
  const letters = props.text.split("");
  letters.push(" ");
  return letters;
});
const finalTransition = computed(() => ({
  ...BASE_TRANSITION,
  ...props.transition,
  duration: (props.transition as { duration?: number } | undefined)?.duration ?? props.duration,
}));

const containerVariants = computed(() => ({
  visible: { rotate: props.reverse ? -360 : 360 },
  // ...props.variants?.container,
}));

const itemVariants = computed(() => ({
  ...BASE_ITEM_VARIANTS,
  ...props?.variants?.item,
}));
</script>
<style scoped></style>

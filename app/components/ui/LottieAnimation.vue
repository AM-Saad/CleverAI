<template>
  <div ref="lottieContainer"></div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue';
import lottie, { type AnimationItem } from 'lottie-web';

interface Props {
  animationData: object;
  width?: string;
  height?: string;
  loop?: boolean;
  autoplay?: boolean;
  speed?: number;
}

const props = withDefaults(defineProps<Props>(), {
  width: '100%',
  height: '100%',
  loop: true,
  autoplay: true,
  speed: 1
});

const lottieContainer = ref<HTMLDivElement>();
let animation: AnimationItem | null = null;

onMounted(() => {
  if (lottieContainer.value && props.animationData) {
    animation = lottie.loadAnimation({
      container: lottieContainer.value,
      renderer: 'svg',
      loop: props.loop,
      autoplay: props.autoplay,
      animationData: props.animationData
    });

    if (props.speed !== 1) {
      animation.setSpeed(props.speed);
    }
  }
});

watch(() => props.speed, (newSpeed) => {
  if (animation) {
    animation.setSpeed(newSpeed);
  }
});

onUnmounted(() => {
  if (animation) {
    animation.destroy();
  }
});
</script>


<style scoped>
svg {
  width: unset !important;
  height: unset !important;
}
</style>
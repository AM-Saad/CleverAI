<template>
  <div class="ai-shimmer" role="status" aria-label="Generating">
    <div v-for="(w, i) in widths" :key="i" class="ai-shimmer__bar" :style="{ width: w }" />
  </div>
</template>

<script setup lang="ts">
/**
 * AiShimmer — the AI streaming indicator (one of the four sanctioned
 * brand-gradient surfaces). A gradient sweep across skeleton bars instead of a
 * spinner, signalling generation-in-progress. Respects reduced motion.
 */
withDefaults(defineProps<{ lines?: number }>(), { lines: 3 });
const widths = ["100%", "92%", "70%"];
</script>

<style scoped>
.ai-shimmer {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.ai-shimmer__bar {
  height: 12px;
  border-radius: var(--radius-full);
  background-image: var(--ds-brand-gradient);
  background-size: 200% 100%;
  background-position: 200% 0;
  animation: ai-sweep 1.2s var(--ease-standard) infinite;
  opacity: 0.85;
}
.ai-shimmer__bar:nth-child(2) {
  animation-delay: 0.15s;
}
.ai-shimmer__bar:nth-child(3) {
  animation-delay: 0.3s;
}
@keyframes ai-sweep {
  to {
    background-position: -200% 0;
  }
}
@media (prefers-reduced-motion: reduce) {
  .ai-shimmer__bar {
    animation: none;
    background-position: 0 0;
  }
}
</style>

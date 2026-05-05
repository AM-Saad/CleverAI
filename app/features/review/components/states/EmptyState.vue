<template>
  <div class="text-center py-12 animate-fade-in">
    <div class="text-6xl mb-4">🎉</div>
    <UiTitle size="2xl" weight="bold" class="mb-2">All caught up!</UiTitle>
    <UiParagraph color="content-secondary" class="mb-6">
      No cards are due for review right now. Great job!
      <span v-if="studySessionReviews && studySessionReviews > 0">
        You reviewed {{ studySessionReviews }} cards this session.
      </span>
    </UiParagraph>
    <div class="flex justify-center space-x-4">
      <UButton @click="$emit('refresh')" color="primary" variant="solid" icon="i-heroicons-arrow-path">
        Check Again
      </UButton>
      <UButton @click="$emit('showAnalytics')" color="neutral" variant="solid" icon="i-heroicons-chart-bar">
        View Analytics
      </UButton>
    </div>
  </div>
</template>

<script setup lang="ts">
interface Props {
  studySessionReviews?: number
}

defineProps<Props>()

defineEmits<{
  refresh: []
  showAnalytics: []
}>()
</script>

<style scoped>
.animate-fade-in {
  animation: fadeIn 0.3s ease-out;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(-10px);
  }

  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>

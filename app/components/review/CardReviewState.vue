<template>
  <div
    class="mt-6 grid grid-cols-3 gap-4 text-center text-sm text-gray-500 dark:text-gray-400"
    role="region"
    aria-label="Card review state metrics"
  >
    <div>
      <div class="font-medium text-gray-900 dark:text-gray-100">
        {{ reviewState.repetitions }}
      </div>
      <div>Reviews</div>
    </div>
    <div>
      <div class="font-medium text-gray-900 dark:text-gray-100">
        {{ reviewState.easeFactor.toFixed(1) }}
      </div>
      <div>Ease</div>
    </div>
    <div>
      <div class="font-medium text-gray-900 dark:text-gray-100">
        {{ reviewState.intervalDays }}d
      </div>
      <div>Interval</div>
    </div>
  </div>
</template>

<script setup lang="ts">
interface ReviewState {
  repetitions: number
  easeFactor: number
  intervalDays: number
  nextReviewAt: string
  lastReviewedAt?: string
}

interface Props {
  reviewState: ReviewState
}

defineProps<Props>()
</script>

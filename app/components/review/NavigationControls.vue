<template>
  <div class="flex justify-between pt-4">
    <button
      @click="$emit('previous')"
      :disabled="isFirstCard || isSubmitting"
      class="px-4 py-2 bg-gray-200 hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed text-gray-700 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
      aria-label="Go to previous card"
    >
      <Icon name="heroicons:arrow-left" class="w-4 h-4 inline mr-1" />
      Previous
    </button>

    <button
      @click="$emit('skip')"
      :disabled="isSubmitting"
      class="px-4 py-2 bg-yellow-500 hover:bg-yellow-600 text-white rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:ring-offset-2"
      aria-label="Skip this card without grading"
    >
      <Icon name="heroicons:forward" class="w-4 h-4 inline mr-1" />
      Skip <span class="text-sm opacity-75">(S)</span>
    </button>

    <button
      @click="$emit('next')"
      :disabled="isLastCard || isSubmitting"
      class="px-4 py-2 bg-gray-200 hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed text-gray-700 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
      aria-label="Go to next card"
    >
      Next
      <Icon name="heroicons:arrow-right" class="w-4 h-4 inline ml-1" />
    </button>
  </div>
</template>

<script setup lang="ts">
interface Props {
  isFirstCard: boolean
  isLastCard: boolean
  isSubmitting: boolean
}

defineProps<Props>()

defineEmits<{
  previous: []
  next: []
  skip: []
}>()
</script>

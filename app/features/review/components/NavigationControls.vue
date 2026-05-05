<template>
  <div class="flex justify-between pt-4">
    <UButton @click="$emit('previous')" :disabled="isFirstCard || isSubmitting" color="neutral" variant="soft"
      icon="i-heroicons-arrow-left" aria-label="Go to previous card">
      Previous
    </UButton>

    <UButton @click="$emit('skip')" :disabled="isSubmitting" color="warning" variant="soft" icon="i-heroicons-forward"
      aria-label="Skip this card without grading">
      Skip <span class="text-sm opacity-75">(S)</span>
    </UButton>

    <UButton @click="$emit('next')" :disabled="isLastCard || isSubmitting" color="neutral" variant="soft"
      trailing-icon="i-heroicons-arrow-right" aria-label="Go to next card">
      Next
    </UButton>
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

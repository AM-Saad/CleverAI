<template>
  <div class="space-y-4">
    <!-- Grade Question -->
    <div class="text-center text-gray-700 dark:text-gray-300 font-medium">
      How well did you know this?
    </div>

    <!-- Grade Buttons -->
    <div
      class="grid grid-cols-2 md:grid-cols-6 gap-2"
      role="group"
      aria-label="Grade card options"
    >
      <button
        v-for="(gradeOption, index) in gradeOptions"
        :key="index"
        @click="$emit('grade', gradeOption.value)"
        :disabled="isSubmitting"
        class="relative p-3 text-center border rounded-lg transition-all duration-200 hover:bg-gray-100 dark:hover:bg-gray-600 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-offset-2"
        :class="[gradeOption.colorClass, { 'animate-pulse': isSubmitting }]"
        :aria-label="`Grade ${gradeOption.value}: ${gradeOption.label} - ${gradeOption.description}`"
      >
        <div class="font-semibold">{{ gradeOption.label }}</div>
        <div class="text-xs mt-1">{{ gradeOption.description }}</div>
        <div class="absolute top-1 right-1 text-xs opacity-50">
          {{ index + 1 }}
        </div>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { ReviewGrade } from '~/shared/utils/review.contract'

interface GradeOption {
  value: ReviewGrade
  label: string
  description: string
  colorClass: string
}

interface Props {
  isSubmitting: boolean
}

defineProps<Props>()

defineEmits<{
  grade: [value: ReviewGrade]
}>()

const gradeOptions: GradeOption[] = [
  {
    value: '0',
    label: 'Again',
    description: 'Complete blackout',
    colorClass:
      'border-red-500 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 focus:ring-red-500',
  },
  {
    value: '1',
    label: 'Hard',
    description: 'Incorrect, easy to recall',
    colorClass:
      'border-orange-500 text-orange-600 hover:bg-orange-50 dark:hover:bg-orange-900/20 focus:ring-orange-500',
  },
  {
    value: '2',
    label: 'Hard',
    description: 'Incorrect, difficult to recall',
    colorClass:
      'border-orange-400 text-orange-600 hover:bg-orange-50 dark:hover:bg-orange-900/20 focus:ring-orange-500',
  },
  {
    value: '3',
    label: 'Good',
    description: 'Correct, difficult recall',
    colorClass:
      'border-yellow-500 text-yellow-600 hover:bg-yellow-50 dark:hover:bg-yellow-900/20 focus:ring-yellow-500',
  },
  {
    value: '4',
    label: 'Good',
    description: 'Correct, hesitant',
    colorClass:
      'border-blue-500 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 focus:ring-blue-500',
  },
  {
    value: '5',
    label: 'Easy',
    description: 'Perfect response',
    colorClass:
      'border-green-500 text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 focus:ring-green-500',
  },
]
</script>

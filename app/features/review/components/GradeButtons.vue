<template>
  <div class="space-y-4">
    <!-- Grade Question -->
    <div class="text-center text-content-on-surface font-medium">
      How well did you know this?
    </div>

    <!-- Grade Buttons -->
    <div class="grid grid-cols-2 md:grid-cols-6 gap-2" role="group" aria-label="Grade card options">
      <button v-for="(gradeOption, index) in gradeOptions" :key="index" @click="$emit('grade', gradeOption.value)"
        :disabled="isSubmitting"
        class="relative p-1 text-center border rounded-[var(--radius-lg)] transition-all duration-200 hover:bg-surface-subtle disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-offset-2 cursor-pointer"
        :class="[gradeOption.colorClass, { 'animate-pulse': isSubmitting }]"
        :aria-label="`Grade ${gradeOption.value}: ${gradeOption.label} - ${gradeOption.description}`">
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
      'border-error text-error hover:bg-error/10 dark:hover:bg-error/20 focus:ring-error',
  },
  {
    value: '1',
    label: 'Hard',
    description: 'Incorrect, easy to recall',
    colorClass:
      'border-warning text-warning hover:bg-warning/10 dark:hover:bg-warning/20 focus:ring-warning',
  },
  {
    value: '2',
    label: 'Hard',
    description: 'Incorrect, difficult to recall',
    colorClass:
      'border-warning text-warning hover:bg-warning/10 dark:hover:bg-warning/20 focus:ring-warning',
  },
  {
    value: '3',
    label: 'Good',
    description: 'Correct, difficult recall',
    colorClass:
      'border-warning text-warning hover:bg-warning/10 dark:hover:bg-warning/20 focus:ring-warning',
  },
  {
    value: '4',
    label: 'Good',
    description: 'Correct, hesitant',
    colorClass:
      'border-info text-info hover:bg-info/10 focus:ring-info/50',
  },
  {
    value: '5',
    label: 'Easy',
    description: 'Perfect response',
    colorClass:
      'border-success text-success hover:bg-success/10 dark:hover:bg-success/20 focus:ring-success',
  },
]
</script>

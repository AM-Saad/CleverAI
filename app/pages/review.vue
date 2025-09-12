<template>
  <div class="container mx-auto px-4 py-8">
    <div class="max-w-4xl mx-auto">
      <!-- Header -->
      <div class="flex justify-between items-center mb-8">
        <div>
          <h1 class="text-3xl font-bold text-gray-900 dark:text-gray-100">
            Spaced Repetition Review
          </h1>
          <p class="text-gray-600 dark:text-gray-400 mt-2">
            Review your cards using the spaced repetition algorithm
          </p>
        </div>
        
        <div class="flex space-x-4">
          <button
            class="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
            @click="refreshQueue"
          >
            Refresh Queue
          </button>
          
          <NuxtLink
            to="/folders"
            class="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg transition-colors"
          >
            Back to Folders
          </NuxtLink>
        </div>
      </div>

      <!-- Review Stats -->
      <div class="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <div class="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
          <div class="text-2xl font-bold text-blue-600">{{ stats.total }}</div>
          <div class="text-gray-600 dark:text-gray-400">Total Cards</div>
        </div>
        <div class="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
          <div class="text-2xl font-bold text-green-600">{{ stats.new }}</div>
          <div class="text-gray-600 dark:text-gray-400">New Cards</div>
        </div>
        <div class="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
          <div class="text-2xl font-bold text-orange-600">{{ stats.learning }}</div>
          <div class="text-gray-600 dark:text-gray-400">Learning</div>
        </div>
        <div class="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
          <div class="text-2xl font-bold text-red-600">{{ stats.due }}</div>
          <div class="text-gray-600 dark:text-gray-400">Due Now</div>
        </div>
      </div>

      <!-- Review Interface -->
      <div v-if="isLoading" class="text-center py-12">
        <Loading />
        <p class="text-gray-600 dark:text-gray-400 mt-4">
          Loading review cards...
        </p>
      </div>

      <div v-else-if="error" class="text-center py-12">
        <div class="text-red-600 mb-4">{{ error }}</div>
        <button
          class="px-6 py-3 bg-red-600 hover:bg-red-700 text-white font-medium rounded-lg transition-colors"
          @click="clearError"
        >
          Clear Error
        </button>
      </div>

      <div v-else-if="!hasCards" class="text-center py-12">
        <div class="text-6xl mb-4">🎉</div>
        <h2 class="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">
          All caught up!
        </h2>
        <p class="text-gray-600 dark:text-gray-400 mb-6">
          No cards are due for review right now. Great job!
        </p>
        <NuxtLink
          to="/folders"
          class="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
        >
          Browse Materials
        </NuxtLink>
      </div>

      <div v-else class="space-y-6">
        <!-- Progress -->
        <div class="bg-white dark:bg-gray-800 p-4 rounded-lg shadow">
          <div class="flex justify-between items-center mb-2">
            <span class="text-sm font-medium text-gray-700 dark:text-gray-300">
              Progress
            </span>
            <span class="text-sm text-gray-600 dark:text-gray-400">
              {{ currentCardIndex + 1 }} of {{ queue.length }}
            </span>
          </div>
          <div class="w-full bg-gray-200 rounded-full h-2 dark:bg-gray-700">
            <div 
              class="bg-blue-600 h-2 rounded-full transition-all duration-300"
              :style="{ width: `${progress}%` }"
            />
          </div>
        </div>

        <!-- Current Card -->
        <div v-if="currentCard" class="bg-white dark:bg-gray-800 rounded-lg shadow-lg overflow-hidden">
          <!-- Card Content -->
          <div class="p-8">
            <!-- Question -->
            <div class="mb-8">
              <h2 class="text-lg font-medium text-gray-700 dark:text-gray-300 mb-4">
                Question
              </h2>
              <div class="text-xl font-medium text-gray-900 dark:text-gray-100 leading-relaxed">
                {{ currentCard.material.front }}
              </div>
            </div>

            <!-- Answer (when revealed) -->
            <div v-if="showAnswer" class="border-t pt-8">
              <h3 class="text-lg font-medium text-gray-700 dark:text-gray-300 mb-4">
                Answer
              </h3>
              <div class="text-gray-800 dark:text-gray-200 leading-relaxed whitespace-pre-wrap">
                {{ currentCard.material.back }}
              </div>
            </div>
          </div>

          <!-- Actions -->
          <div class="border-t bg-gray-50 dark:bg-gray-700 p-6">
            <div v-if="!showAnswer" class="flex justify-center">
              <button
                class="px-8 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
                @click="showAnswer = true"
              >
                Show Answer
              </button>
            </div>
            
            <div v-else class="space-y-4">
              <div class="text-center text-gray-700 dark:text-gray-300 font-medium">
                How well did you know this?
              </div>
              
              <!-- Grade Buttons -->
              <div class="grid grid-cols-2 md:grid-cols-6 gap-2">
                <button
                  v-for="grade in gradeOptions"
                  :key="grade.value"
                  :disabled="isSubmitting"
                  class="p-3 text-center border rounded-lg transition-colors hover:bg-gray-100 dark:hover:bg-gray-600 disabled:opacity-50"
                  :class="grade.colorClass"
                  @click="gradeCard(grade.value)"
                >
                  <div class="font-semibold">{{ grade.label }}</div>
                  <div class="text-xs mt-1">{{ grade.description }}</div>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { ReviewCard, ReviewQueueResponse, GradeCardResponse, ReviewGrade } from '~/shared/review.contract'

// SEO
useHead({
  title: 'Review Cards - CleverAI',
  meta: [
    { name: 'description', content: 'Review your flashcards using spaced repetition algorithm' }
  ]
})

// State
const queue = ref<ReviewCard[]>([])
const currentCardIndex = ref(0)
const showAnswer = ref(false)
const isLoading = ref(false)
const isSubmitting = ref(false)
const error = ref<string | null>(null)
const stats = ref({
  total: 0,
  new: 0,
  due: 0,
  learning: 0
})

// Computed
const currentCard = computed(() => queue.value[currentCardIndex.value] || null)
const hasCards = computed(() => queue.value.length > 0)
const progress = computed(() => {
  if (!hasCards.value) return 0
  return Math.round(((currentCardIndex.value + 1) / queue.value.length) * 100)
})

// Grade options
const gradeOptions = [
  { 
    value: '0' as ReviewGrade, 
    label: 'Again', 
    description: 'Complete blackout',
    colorClass: 'border-red-500 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20'
  },
  { 
    value: '1' as ReviewGrade, 
    label: 'Hard', 
    description: 'Incorrect, easy recall',
    colorClass: 'border-orange-500 text-orange-600 hover:bg-orange-50 dark:hover:bg-orange-900/20'
  },
  { 
    value: '2' as ReviewGrade, 
    label: 'Hard', 
    description: 'Incorrect, difficult',
    colorClass: 'border-orange-400 text-orange-600 hover:bg-orange-50 dark:hover:bg-orange-900/20'
  },
  { 
    value: '3' as ReviewGrade, 
    label: 'Good', 
    description: 'Correct, difficult',
    colorClass: 'border-yellow-500 text-yellow-600 hover:bg-yellow-50 dark:hover:bg-yellow-900/20'
  },
  { 
    value: '4' as ReviewGrade, 
    label: 'Good', 
    description: 'Correct, hesitant',
    colorClass: 'border-blue-500 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20'
  },
  { 
    value: '5' as ReviewGrade, 
    label: 'Easy', 
    description: 'Perfect response',
    colorClass: 'border-green-500 text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20'
  }
]

// Methods
const fetchQueue = async () => {
  isLoading.value = true
  error.value = null
  
  try {
    const response = await $fetch<ReviewQueueResponse>('/api/review/queue')
    queue.value = response.cards
    stats.value = response.stats
    currentCardIndex.value = 0
    showAnswer.value = false
  } catch (err: unknown) {
    const errorMsg = err && typeof err === 'object' && 'data' in err 
      ? (err as { data?: { message?: string } }).data?.message 
      : 'Failed to fetch review queue'
    error.value = errorMsg || 'Failed to fetch review queue'
  } finally {
    isLoading.value = false
  }
}

const gradeCard = async (grade: ReviewGrade) => {
  if (!currentCard.value) return
  
  isSubmitting.value = true
  
  try {
    await $fetch<GradeCardResponse>('/api/review/grade', {
      method: 'POST',
      body: { cardId: currentCard.value.cardId, grade }
    })
    
    // Remove graded card from queue
    queue.value.splice(currentCardIndex.value, 1)
    stats.value.due = Math.max(0, stats.value.due - 1)
    
    // Reset for next card
    showAnswer.value = false
    
    // Adjust index if needed
    if (currentCardIndex.value >= queue.value.length) {
      currentCardIndex.value = Math.max(0, queue.value.length - 1)
    }
    
  } catch (err: unknown) {
    const errorMsg = err && typeof err === 'object' && 'data' in err 
      ? (err as { data?: { message?: string } }).data?.message 
      : 'Failed to grade card'
    error.value = errorMsg || 'Failed to grade card'
  } finally {
    isSubmitting.value = false
  }
}

const refreshQueue = () => {
  fetchQueue()
}

const clearError = () => {
  error.value = null
}

// Initialize
onMounted(() => {
  fetchQueue()
})
</script>

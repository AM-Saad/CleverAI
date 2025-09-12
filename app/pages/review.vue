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
                    <button class="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                        @click="refreshQueue">
                        Refresh Queue
                    </button>

                    <NuxtLink to="/folders"
                        class="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg transition-colors">
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
                    @click="clearError">
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
                <NuxtLink to="/folders"
                    class="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors">
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
                        <div class="bg-blue-600 h-2 rounded-full transition-all duration-300"
                            :style="{ width: `${progress}%` }" />
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
                                {{ resourceFront }}
                            </div>
                        </div>

                        <!-- Answer (when revealed) -->
                        <div v-if="showAnswer" class="border-t pt-8">
                            <h3 class="text-lg font-medium text-gray-700 dark:text-gray-300 mb-4">
                                Answer
                            </h3>
                            <div class="text-gray-800 dark:text-gray-200 leading-relaxed whitespace-pre-wrap">
                                {{ resourceBack }}
                            </div>
                        </div>
                    </div>

                    <!-- Actions -->
                    <div class="border-t bg-gray-50 dark:bg-gray-700 p-6">
                        <div v-if="!showAnswer" class="flex justify-center">
                            <button
                                class="px-8 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
                                @click="showAnswer = true">
                                Show Answer
                            </button>
                        </div>

                        <div v-else class="space-y-4">
                            <div class="text-center text-gray-700 dark:text-gray-300 font-medium">
                                How well did you know this?
                            </div>

                            <!-- Grade Buttons -->
                            <div class="grid grid-cols-2 md:grid-cols-6 gap-2">
                                <button v-for="grade in gradeOptions" :key="grade.value" :disabled="isSubmitting"
                                    class="p-3 text-center border rounded-lg transition-colors hover:bg-gray-100 dark:hover:bg-gray-600 disabled:opacity-50"
                                    :class="grade.colorClass" @click="handleGradeCard(grade.value)">
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
import type { ReviewGrade } from '~/shared/review.contract'

// SEO
useHead({
    title: 'Review Cards - CleverAI',
    meta: [
        { name: 'description', content: 'Review your flashcards using spaced repetition algorithm' }
    ]
})

// Get composable for review functionality
// Use the useCardReview composable instead of managing state manually
const {
    reviewQueue,
    currentCard,
    currentCardIndex,
    queueStats,
    isLoading,
    isSubmitting,
    error,
    hasCards,
    progress,
    grade: gradeCard,
    fetchQueue,
    clearError
} = useCardReview()

// Alias queue and stats for compatibility with existing template
const queue = reviewQueue
const stats = queueStats

// UI State (not managed by composable)
const showAnswer = ref(false)

// Initialize on mount
onMounted(() => {
    fetchQueue()
})

// Resource accessors for polymorphic review items
const resourceFront = computed(() => {
    const c = currentCard.value
    if (!c) return ''
    if (c.resourceType === 'flashcard') {
        const flashcardResource = c.resource as { front: string; back: string; folderId: string; hint?: string; tags?: string[] }
        return flashcardResource.front
    }
    const materialResource = c.resource as { title: string; content: string; folderId: string; tags?: string[] }
    return materialResource.title
})

const resourceBack = computed(() => {
    const c = currentCard.value
    if (!c) return ''
    if (c.resourceType === 'flashcard') {
        const flashcardResource = c.resource as { front: string; back: string; folderId: string; hint?: string; tags?: string[] }
        return flashcardResource.back
    }
    const materialResource = c.resource as { title: string; content: string; folderId: string; tags?: string[] }
    return materialResource.content
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

// Additional methods for this page
const refreshQueue = () => {
    fetchQueue()
}

const handleGradeCard = async (gradeValue: ReviewGrade) => {
    if (!currentCard.value) return

    try {
        await gradeCard(currentCard.value.cardId, gradeValue)
        // Reset answer visibility for next card
        showAnswer.value = false
    } catch (err) {
        console.error('Failed to grade card:', err)
    }
}

// Initialize
onMounted(() => {
    fetchQueue()
})
</script>

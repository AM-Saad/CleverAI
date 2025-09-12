<template>
    <div class="max-w-4xl mx-auto p-6 space-y-6">
        <!-- Header with stats and progress -->
        <div class="flex justify-between items-center">
            <div class="flex items-center space-x-4">
                <h1 class="text-2xl font-bold text-gray-900 dark:text-gray-100">
                    Card Review
                </h1>
                <div class="text-sm text-gray-600 dark:text-gray-400">
                    {{ currentCardIndex + 1 }} of {{ reviewQueue.length }}
                </div>
            </div>

            <div class="flex items-center space-x-4">
                <!-- Stats -->
                <div class="flex space-x-4 text-sm">
                    <div class="text-center">
                        <div class="font-semibold text-blue-600">{{ queueStats.new }}</div>
                        <div class="text-gray-500">New</div>
                    </div>
                    <div class="text-center">
                        <div class="font-semibold text-orange-600">{{ queueStats.learning }}</div>
                        <div class="text-gray-500">Learning</div>
                    </div>
                    <div class="text-center">
                        <div class="font-semibold text-red-600">{{ queueStats.due }}</div>
                        <div class="text-gray-500">Due</div>
                    </div>
                </div>

                <!-- Progress bar -->
                <div class="w-32 bg-gray-200 rounded-full h-2 dark:bg-gray-700">
                    <div class="bg-blue-600 h-2 rounded-full transition-all duration-300"
                        :style="{ width: `${progress}%` }" />
                </div>
            </div>
        </div>

        <!-- Card Display -->
        <div v-if="currentCard" class="bg-white dark:bg-gray-800 rounded-lg shadow-lg overflow-hidden">
            <!-- Card Content -->
            <div class="p-8">
                <!-- Question/Front -->
                <div class="mb-8">
                    <h2 class="text-lg font-medium text-gray-700 dark:text-gray-300 mb-4">
                        Question
                    </h2>
                    <div class="text-xl font-medium text-gray-900 dark:text-gray-100 leading-relaxed">
                        {{ resourceFront }}
                    </div>
                </div>

                <!-- Answer/Back (shown when revealed) -->
                <div v-if="showAnswer" class="border-t pt-8">
                    <h3 class="text-lg font-medium text-gray-700 dark:text-gray-300 mb-4">
                        Answer
                    </h3>
                    <div class="text-gray-800 dark:text-gray-200 leading-relaxed prose prose-sm max-w-none">
                        <!-- Using text content to avoid XSS -->
                        <div class="whitespace-pre-wrap">{{ formatContent(resourceBack) }}</div>
                    </div>

                    <!-- Hint if available -->
                    <div v-if="resourceHint" class="mt-4 p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
                        <div class="text-sm font-medium text-yellow-800 dark:text-yellow-200 mb-1">
                            Hint:
                        </div>
                        <div class="text-yellow-700 dark:text-yellow-300">
                            {{ resourceHint }}
                        </div>
                    </div>
                </div>
            </div>

            <!-- Action Buttons -->
            <div class="border-t bg-gray-50 dark:bg-gray-700 p-6">
                <div v-if="!showAnswer" class="flex justify-center">
                    <button @click="showAnswer = true"
                        class="px-8 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors">
                        Show Answer
                    </button>
                </div>

                <div v-else class="space-y-4">
                    <!-- Grade Question -->
                    <div class="text-center text-gray-700 dark:text-gray-300 font-medium">
                        How well did you know this?
                    </div>

                    <!-- Grade Buttons -->
                    <div class="grid grid-cols-2 md:grid-cols-6 gap-2">
                        <button v-for="(gradeOption, index) in gradeOptions" :key="index"
                            @click="gradeCard(gradeOption.value)" :disabled="isSubmitting"
                            class="p-3 text-center border rounded-lg transition-colors hover:bg-gray-100 dark:hover:bg-gray-600 disabled:opacity-50"
                            :class="gradeOption.colorClass">
                            <div class="font-semibold">{{ gradeOption.label }}</div>
                            <div class="text-xs mt-1">{{ gradeOption.description }}</div>
                        </button>
                    </div>

                    <!-- Navigation Buttons -->
                    <div class="flex justify-between pt-4">
                        <button @click="previousCard" :disabled="isFirstCard"
                            class="px-4 py-2 bg-gray-200 hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed text-gray-700 rounded-lg transition-colors">
                            ← Previous
                        </button>

                        <button @click="skipCard"
                            class="px-4 py-2 bg-yellow-500 hover:bg-yellow-600 text-white rounded-lg transition-colors">
                            Skip
                        </button>

                        <button @click="nextCard" :disabled="isLastCard"
                            class="px-4 py-2 bg-gray-200 hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed text-gray-700 rounded-lg transition-colors">
                            Next →
                        </button>
                    </div>
                </div>
            </div>
        </div>

        <!-- Empty State -->
        <div v-else-if="!isLoading" class="text-center py-12">
            <div class="text-6xl mb-4">🎉</div>
            <h2 class="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">
                All caught up!
            </h2>
            <p class="text-gray-600 dark:text-gray-400 mb-6">
                No cards are due for review right now. Great job!
            </p>
            <button @click="$emit('refresh')"
                class="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors">
                Check Again
            </button>
        </div>

        <!-- Loading State -->
        <div v-if="isLoading" class="text-center py-12">
            <Loading />
            <p class="text-gray-600 dark:text-gray-400 mt-4">
                Loading review cards...
            </p>
        </div>

        <!-- Error State -->
        <div v-if="error" class="text-center py-12">
            <div class="text-red-600 mb-4">
                {{ error }}
            </div>
            <button @click="clearError"
                class="px-6 py-3 bg-red-600 hover:bg-red-700 text-white font-medium rounded-lg transition-colors">
                Clear Error
            </button>
        </div>
    </div>
</template>

<script setup lang="ts">
import type { ReviewGrade } from '~/shared/review.contract'

interface Props {
    folderId?: string
}

const props = defineProps<Props>()

const emit = defineEmits<{
    refresh: []
    cardGraded: [cardId: string, grade: ReviewGrade]
}>()

// Composable
const {
    reviewQueue,
    currentCard,
    currentCardIndex,
    queueStats,
    isLoading,
    isSubmitting,
    error,
    hasCards,
    isFirstCard,
    isLastCard,
    progress,
    grade,
    fetchQueue,
    nextCard: goToNextCard,
    previousCard: goToPreviousCard,
    clearError
} = useCardReview()

// Resource accessors for polymorphic items
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

const resourceHint = computed(() => {
    const c = currentCard.value
    if (!c) return undefined
    if (c.resourceType === 'flashcard') {
        const flashcardResource = c.resource as { front: string; back: string; folderId: string; hint?: string; tags?: string[] }
        return flashcardResource.hint
    }
    return undefined
})

// Local state
const showAnswer = ref(false)

// Grade options for SM-2
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
        description: 'Incorrect, easy to recall',
        colorClass: 'border-orange-500 text-orange-600 hover:bg-orange-50 dark:hover:bg-orange-900/20'
    },
    {
        value: '2' as ReviewGrade,
        label: 'Hard',
        description: 'Incorrect, difficult to recall',
        colorClass: 'border-orange-400 text-orange-600 hover:bg-orange-50 dark:hover:bg-orange-900/20'
    },
    {
        value: '3' as ReviewGrade,
        label: 'Good',
        description: 'Correct, difficult recall',
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
const gradeCard = async (gradeValue: ReviewGrade) => {
    if (!currentCard.value) return

    try {
        await grade(currentCard.value.cardId, gradeValue)
        emit('cardGraded', currentCard.value.cardId, gradeValue)

        // Reset for next card
        showAnswer.value = false

        // If no more cards, emit refresh
        if (!hasCards.value) {
            emit('refresh')
        }
    } catch (err) {
        console.error('Failed to grade card:', err)
    }
}

const nextCard = () => {
    showAnswer.value = false
    goToNextCard()
}

const previousCard = () => {
    showAnswer.value = false
    goToPreviousCard()
}

const skipCard = () => {
    showAnswer.value = false
    nextCard()
}

const formatContent = (content: string) => {
    // Basic markdown-like formatting
    return content
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.*?)\*/g, '<em>$1</em>')
        .replace(/\n/g, '<br>')
}

// Watch for prop changes
watch(() => props.folderId, () => {
    fetchQueue(props.folderId)
}, { immediate: true })

// Reset answer visibility when card changes
watch(currentCard, () => {
    showAnswer.value = false
})
</script>

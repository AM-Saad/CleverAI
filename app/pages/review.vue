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

            <!-- Enhanced Review Interface -->
            <ReviewCardReviewInterface @refresh="refreshQueue" @complete="handleReviewComplete" />
        </div>
    </div>
</template>

<script setup lang="ts">
// SEO
useHead({
    title: 'Review Cards - CleverAI',
    meta: [
        { name: 'description', content: 'Review your flashcards using spaced repetition algorithm' }
    ]
})

// Get composable for review functionality
const { fetchQueue } = useCardReview()

// Additional methods for this page
const refreshQueue = () => {
    fetchQueue()
}

const handleReviewComplete = () => {
    // Handle completion - maybe redirect or show success message
    console.log('Review session completed!')
}

// Initialize on mount
onMounted(() => {
    fetchQueue()
})
</script>

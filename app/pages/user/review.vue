<template>
  <shared-page-wrapper title="Spaced Repetition Review"
    subtitle="Review your cards using the spaced repetition algorithm">
    <template #actions>
      <div class="flex items-center space-x-4">
        <u-button @click="refreshQueue">
          Refresh Queue
        </u-button>

        <NuxtLink to="/folders">
          Back to Folders
        </NuxtLink>
      </div>
    </template>


    <!-- Enhanced Review Interface -->
    <ReviewCardReviewInterface @refresh="refreshQueue" @complete="handleReviewComplete" />
  </shared-page-wrapper>
</template>

<script setup lang="ts">
const ReviewCardReviewInterface = defineAsyncComponent(
  () => import("~/components/review/CardReviewInterface.refactored.vue"),
);
// SEO
useHead({
  title: "Review Cards - CleverAI",
  meta: [
    {
      name: "description",
      content: "Review your flashcards using spaced repetition algorithm",
    },
  ],
});

// Get composable for review functionality
const { fetchQueue } = useCardReview();

// Additional methods for this page
const refreshQueue = () => {
  fetchQueue();
};

const handleReviewComplete = () => {
  // Handle completion - maybe redirect or show success message
  console.log("Review session completed!");
};

// Initialize on mount
onMounted(() => {
  fetchQueue();
});
</script>

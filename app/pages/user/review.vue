<template>
  <ReviewPageContainer />
</template>

<script setup lang="ts">
import ReviewPageContainer from "~/features/review/containers/ReviewPageContainer.vue";

useHead({
  title: "Review Cards - Cognilo",
  meta: [
    {
      name: "description",
      content: "Review your flashcards using spaced repetition algorithm",
    },
  ],
});
</script>

<template>
  <LanguageReviewContainer />
</template>

<script setup lang="ts">
import LanguageReviewContainer from "~/features/language-learning/containers/LanguageReviewContainer.vue";

definePageMeta({ middleware: "auth", layout: "default" });
</script>

<template>
  <div class="learning-home">

    <LearningHome />
  </div>
</template>

<script setup lang="ts">
import AppPageHeader from "~/components/patterns/AppPageHeader.vue";
import LearningHome from "~/features/learning-shell/components/LearningHome.vue";

definePageMeta({ middleware: "auth" });
const accountLink = {
  path: "/account",
  query: { app: "learning", returnTo: "/learn" },
};
</script>

<style scoped>
.learning-home {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  padding-bottom: var(--space-6);
}
</style>

<template>
  <div class="learning-home">
    <LearningHome />
  </div>
</template>

<script setup lang="ts">
import LearningHome from "~/features/learning-shell/components/LearningHome.vue";

definePageMeta({ middleware: "auth" });
</script>

<style scoped>
.learning-home {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  padding-bottom: var(--space-6);
}
</style>

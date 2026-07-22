<template>
  <div class="learning-home">
    <AppPageHeader
      title="Learning"
      subtitle="Your materials, practice, and topics"
      :account-to="accountLink"
      account-label="Learning account settings"
    />
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
  gap: var(--space-6);
  padding: var(--space-4) var(--space-4) var(--space-8);
}
</style>

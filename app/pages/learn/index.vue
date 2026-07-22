<template>
  <div class="learning-home">
    <div class="learning-home__bar">
      <NuxtLink to="/" class="learning-home__apps">
        <UiIcon name="i-lucide-layout-grid" class="h-4 w-4" />
        Apps
      </NuxtLink>
      <span>Learning</span>
      <NuxtLink :to="accountLink" aria-label="Learning account settings">
        <UiIcon name="i-lucide-user-round" class="h-5 w-5" />
      </NuxtLink>
    </div>
    <LearningHome />
  </div>
</template>

<script setup lang="ts">
import LearningHome from "~/features/learning-shell/components/LearningHome.vue";

definePageMeta({ middleware: "auth" });
const accountLink = {
  path: "/account",
  query: { app: "learning", returnTo: "/learn" },
};
</script>

<style scoped>
.learning-home__bar {
  display: flex;
  min-height: 52px;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-2) var(--space-4);
  border-bottom: 1px solid var(--color-secondary);
  color: var(--color-content-secondary);
  font-size: var(--text-sm);
  font-weight: 700;
}

.learning-home__apps {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
}
</style>

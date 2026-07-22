<template>
  <div class="learning-dashboard">
    <WorkspacePill class="learning-dashboard__workspace" />

    <nav class="learning-dashboard__nav" aria-label="Learning areas">
      <UiListCard
        v-for="destination in destinations"
        :key="destination.to"
        clickable
        variant="soft"
        :title="destination.title"
        :description="destination.description"
        @click="navigateTo(destination.to)"
      >
        <template #leading>
          <span class="learning-dashboard__icon">
            <UiIcon :name="destination.icon" class="h-5 w-5" />
          </span>
        </template>
        <template #action>
          <UiIcon name="i-lucide-chevron-right" class="h-4 w-4" />
        </template>
      </UiListCard>
    </nav>

    <UiPanel variant="subtle" size="md">
      <div class="learning-dashboard__review">
        <span class="learning-dashboard__review-icon">
          <UiIcon name="i-lucide-brain" class="h-5 w-5" />
        </span>
        <div>
          <p>Due for review</p>
          <strong
            >{{ dueCount }} {{ dueCount === 1 ? "card" : "cards" }}</strong
          >
        </div>
        <UiButton to="/review" size="sm">Review</UiButton>
      </div>
    </UiPanel>
  </div>
</template>

<script setup lang="ts">
import WorkspacePill from "~/components/shell/WorkspacePill.vue";

const reviewStats = useReviewStats({ immediate: true });
const dueCount = computed(() => Number(reviewStats.stats.value?.due ?? 0));
const destinations = [
  {
    to: "/materials",
    title: "Materials",
    description: "Source content for this topic",
    icon: "i-lucide-file-stack",
  },
  {
    to: "/review",
    title: "Review",
    description: "Practice with spaced repetition",
    icon: "i-lucide-square-stack",
  },
  {
    to: "/language",
    title: "Language",
    description: "Word bank, stories, and shadowing",
    icon: "i-lucide-languages",
  },
  {
    to: "/workspaces",
    title: "Workspaces",
    description: "Separate topics and learning goals",
    icon: "i-lucide-folders",
  },
];
</script>

<style scoped>
.learning-dashboard {
  display: flex;
  flex-direction: column;
  gap: var(--space-6);
}
.learning-dashboard__workspace {
  align-self: flex-start;
}
.learning-dashboard__nav {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}
.learning-dashboard__icon,
.learning-dashboard__review-icon {
  display: grid;
  place-items: center;
  width: 40px;
  height: 40px;
  border-radius: var(--radius-lg);
  background: var(--color-primary-soft);
  color: var(--color-primary);
}
.learning-dashboard__review {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}
.learning-dashboard__review > div {
  min-width: 0;
  flex: 1;
}
.learning-dashboard__review p {
  color: var(--color-content-secondary);
  font-size: var(--text-xs);
}
.learning-dashboard__review strong {
  color: var(--color-content-on-surface-strong);
}
</style>

<template>
  <div class="learning-dashboard">
    <WorkspacePill />
    <header class="learning-dashboard__header">
      <p>Learning workspace</p>
      <ui-title tag="h1">What will you learn next?</ui-title>
    </header>

    <nav class="learning-dashboard__grid" aria-label="Learning areas">
      <UiInteractiveCard
        v-for="destination in destinations"
        :key="destination.to"
        :to="destination.to"
        size="md"
      >
        <span class="learning-destination__icon">
          <UiIcon :name="destination.icon" class="h-5 w-5" />
        </span>
        <strong>{{ destination.title }}</strong>
        <span class="learning-destination__description">{{
          destination.description
        }}</span>
      </UiInteractiveCard>
    </nav>

    <UiCard variant="surface" size="lg">
      <div class="learning-dashboard__review">
        <span class="learning-dashboard__review-icon">
          <UiIcon name="i-lucide-brain" class="h-6 w-6" />
        </span>
        <div>
          <p>Spaced repetition</p>
          <strong
            >{{ dueCount }}
            {{ dueCount === 1 ? "card" : "cards" }} ready</strong
          >
        </div>
        <UiButton to="/review" size="sm">Review</UiButton>
      </div>
    </UiCard>
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
    description: "Source content for this workspace",
    icon: "i-lucide-file-stack",
  },
  {
    to: "/review",
    title: "Flashcards",
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
    icon: "i-lucide-folder-kanban",
  },
];
</script>

<style scoped>
.learning-dashboard {
  display: flex;
  flex-direction: column;
  gap: var(--space-6);
  padding: var(--space-4) var(--space-4) var(--space-8);
}

.learning-dashboard__header p {
  color: var(--color-primary);
  font-size: var(--text-xs);
  font-weight: 750;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.learning-dashboard__header h1 {
  margin-top: var(--space-1);
  font-size: var(--text-2xl);
}

.learning-dashboard__grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--space-3);
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
  color: var(--color-content-on-surface);
}

.learning-dashboard__review-icon {
  display: grid;
  width: 44px;
  height: 44px;
  place-items: center;
  border-radius: var(--radius-xl);
  background: var(--color-primary-soft);
  color: var(--color-primary);
}

.learning-destination__icon {
  display: grid;
  width: 40px;
  height: 40px;
  margin-bottom: var(--space-3);
  place-items: center;
  border-radius: var(--radius-lg);
  background: var(--color-surface-strong);
  color: var(--color-primary);
}

.learning-destination__description {
  display: block;
  margin-top: var(--space-1);
  color: var(--color-content-secondary);
  font-size: var(--text-xs);
  line-height: 1.4;
}
</style>

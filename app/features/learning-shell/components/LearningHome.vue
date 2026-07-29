<template>
  <div class="learning-dashboard">
    <header class="learning-dashboard__header">
      <UiTitle tag="h1" size="2xl" weight="bold" color="content-on-background" tight>
        Learn
      </UiTitle>
      <WorkspacePill class="learning-dashboard__workspace" />
    </header>

    <section class="learning-dashboard__section" aria-labelledby="learning-today-title">
      <UiTitle id="learning-today-title" tag="h2" size="xs" weight="bold" color="content-on-surface" uppercase>
        Today
      </UiTitle>

      <UiPanel variant="subtle" size="md" :tone="reviewTone" class-name="learning-dashboard__review-panel">
        <div class="learning-dashboard__review">
          <span class="learning-dashboard__review-icon" :class="{
            'learning-dashboard__review-icon--complete':
              reviewState === 'done',
          }" aria-hidden="true">
            <UiIcon :name="reviewIcon" class="h-5 w-5" />
          </span>

          <div class="learning-dashboard__review-copy">
            <strong>{{ reviewTitle }}</strong>
            <p>{{ reviewDescription }}</p>
          </div>

          <UiButton v-if="reviewState === 'loading'" size="sm" tone="neutral" variant="soft" loading disabled
            aria-label="Loading review status">
            Loading
          </UiButton>
          <UiButton v-else-if="reviewState === 'done'" to="/materials" size="sm" tone="neutral" variant="soft">
            Browse
          </UiButton>
          <UiButton v-else to="/review" size="sm">Review</UiButton>
        </div>
      </UiPanel>
    </section>

    <section class="learning-dashboard__section" aria-labelledby="learning-explore-title">
      <UiTitle id="learning-explore-title" tag="h2" size="xs" weight="bold" color="content-on-surface" uppercase>
        Explore
      </UiTitle>

      <UiPanel variant="surface" size="xs">
        <nav class="learning-dashboard__nav" aria-label="Learning areas">
          <UiListCard v-for="destination in destinations" :key="destination.to" :to="destination.to" variant="ghost"
            size="lg" :title="destination.title" :description="destination.description"
            class-name="learning-dashboard__destination">
            <template #leading>
              <span class="learning-dashboard__icon">
                <UiIcon :name="destination.icon" class="h-5 w-5" />
              </span>
            </template>
            <template #action>
              <UiIcon name="chevron-right" class="h-4 w-4" aria-hidden="true" />
            </template>
          </UiListCard>
        </nav>
      </UiPanel>
    </section>
  </div>
</template>

<script setup lang="ts">
import WorkspacePill from "~/components/shell/WorkspacePill.vue";

type ReviewState = "loading" | "error" | "due" | "done";

const { activeId } = useActiveWorkspace();
const activeWorkspaceId = computed(() => activeId.value ?? undefined);
const reviewStats = useReviewStats({
  workspaceId: activeWorkspaceId,
  immediate: true,
});

const dueCount = computed(() => Number(reviewStats.stats.value?.due ?? 0));
const reviewState = computed<ReviewState>(() => {
  if (reviewStats.isLoading.value && !reviewStats.stats.value) return "loading";
  if (reviewStats.error.value) return "error";
  return dueCount.value > 0 ? "due" : "done";
});
const reviewTitle = computed(() => {
  if (reviewState.value === "loading") return "Checking review queue";
  if (reviewState.value === "error") return "Review status unavailable";
  if (reviewState.value === "done") return "You’re caught up";
  return `${dueCount.value} ${dueCount.value === 1 ? "card" : "cards"} ready`;
});
const reviewDescription = computed(() => {
  if (reviewState.value === "loading") return "Finding what’s ready for you.";
  if (reviewState.value === "error") return "Open Review to check your queue.";
  if (reviewState.value === "done") return "No cards due in this workspace.";
  return "Keep memory fresh with a quick review.";
});
const reviewIcon = computed(() => {
  if (reviewState.value === "done") return "circle-check";
  if (reviewState.value === "error") return "circle-alert";
  return "brain";
});
const reviewTone = computed(() => {
  if (reviewState.value === "done") return "success" as const;
  if (reviewState.value === "due") return "info" as const;
  return "neutral" as const;
});

const destinations = [
  {
    to: "/materials",
    title: "Materials",
    description: "Read and organize source content",
    icon: "file-stack",
  },
  {
    to: "/language",
    title: "Language",
    description: "Word bank, stories, and shadowing",
    icon: "languages",
  },
];
</script>

<style scoped>
.learning-dashboard {
  display: flex;
  flex-direction: column;
  gap: var(--space-6);
  padding-top: var(--space-2);
}

.learning-dashboard__header {
  display: flex;
  min-width: 0;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
}

.learning-dashboard__workspace {
  flex-shrink: 1;
}

.learning-dashboard__section {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.learning-dashboard__nav {
  display: flex;
  flex-direction: column;
}

.learning-dashboard__icon {
  display: grid;
  place-items: center;
  width: 40px;
  height: 40px;
  border-radius: var(--radius-lg);
  background: var(--color-primary-soft);
  color: var(--color-primary);
}

.learning-dashboard__destination+.learning-dashboard__destination {
  border-top-color: var(--color-secondary);
}

.learning-dashboard__review {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}

.learning-dashboard__review-icon {
  display: grid;
  flex-shrink: 0;
  place-items: center;
  width: 42px;
  height: 42px;
  border-radius: var(--radius-xl);
  background: var(--color-primary-soft);
  color: var(--color-primary);
}

.learning-dashboard__review-icon--complete {
  background: color-mix(in srgb, var(--color-success) 14%, transparent);
  color: var(--color-success);
}

.learning-dashboard__review-copy {
  min-width: 0;
  flex: 1;
}

.learning-dashboard__review p {
  margin-top: 2px;
  color: var(--color-content-secondary);
  font-size: var(--text-xs);
  line-height: var(--leading-normal);
}

.learning-dashboard__review strong {
  display: block;
  color: var(--color-content-on-surface-strong);
  font-size: var(--text-base);
  line-height: var(--leading-tight);
}

@media (max-width: 380px) {
  .learning-dashboard__review {
    align-items: flex-start;
    flex-wrap: wrap;
  }

  .learning-dashboard__review> :last-child {
    margin-left: 54px;
  }
}
</style>

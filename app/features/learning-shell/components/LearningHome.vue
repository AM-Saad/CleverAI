<template>
  <div class="learning-dashboard">
    <header class="learning-dashboard__header">
      <UiTitle tag="h1" size="2xl" weight="bold" color="content-on-background" tight>
        Learn
      </UiTitle>
      <WorkspacePill class="learning-dashboard__workspace" />
    </header>

    <!-- Today / Review Queue section -->
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

    <!-- Workspace Overview & Stats -->
    <section v-if="activeWorkspace" class="learning-dashboard__section" aria-labelledby="workspace-overview-title">
      <div class="learning-dashboard__section-header">
        <UiTitle id="workspace-overview-title" tag="h2" size="xs" weight="bold" color="content-on-surface" uppercase>
          Workspace Overview
        </UiTitle>
        <UiIconButton
          icon="pencil"
          label="Edit workspace"
          size="xs"
          variant="ghost"
          @click="editSpace"
        />
      </div>

      <div class="learning-dashboard__identity">
        <span class="learning-dashboard__marker" :style="{ background: workspaceAccent }" />
        <div class="min-w-0 flex-1">
          <UiTitle tag="h3" size="lg" weight="bold" color="content-on-surface-strong">
            {{ activeWorkspace.title }}
          </UiTitle>
          <UiParagraph v-if="activeWorkspace.description" size="sm" color="content-secondary">
            {{ activeWorkspace.description }}
          </UiParagraph>
        </div>
        <UiPill label="Private" color="var(--color-content-secondary)" variant="soft">
          <template #icon><UiPillIcon name="lock" size="sm" /></template>
        </UiPill>
      </div>

      <div class="learning-dashboard__stats">
        <UiPanel v-for="item in workspaceStats" :key="item.label" variant="subtle" size="sm">
          <div class="learning-dashboard__stat">
            <strong>{{ item.value }}</strong>
            <span>{{ item.label }}</span>
          </div>
        </UiPanel>
      </div>
    </section>

    <!-- Workspace Activity Feed -->
    <section v-if="activeWorkspace" class="learning-dashboard__section" aria-labelledby="workspace-activity-title">
      <UiTitle id="workspace-activity-title" tag="h2" size="xs" weight="bold" color="content-on-surface" uppercase>
        Recent Activity
      </UiTitle>

      <ul v-if="activity.length" class="learning-dashboard__feed">
        <li v-for="item in activity" :key="item.key">
          <span class="learning-dashboard__event-icon">
            <UiIcon :name="item.icon" class="h-4 w-4" />
          </span>
          <span class="min-w-0 flex-1">
            <strong>{{ item.label }}</strong>
            <small>{{ item.sub }}</small>
          </span>
          <time>{{ relativeTime(item.ts) }}</time>
        </li>
      </ul>
      <UiEmptyState
        v-else
        icon="activity"
        title="No learning activity yet"
        description="Add a material or start reviewing in this workspace."
      />
    </section>

    <!-- Explore -->
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
import { ref, computed, watch, onMounted } from "vue";
import WorkspacePill from "~/components/shell/WorkspacePill.vue";
import { accentVarFor } from "~/composables/useAccentColor";
import { useActiveWorkspace } from "~/composables/workspaces/useActiveWorkspace";
import { useMaterialsStore } from "~/composables/workspaces/useMaterialsStore";
import type { ReviewWorkspaceStats } from "@shared/utils/review.contract";

type ReviewState = "loading" | "error" | "due" | "done";

const { $api } = useNuxtApp();
const { activeId, activeWorkspace } = useActiveWorkspace();
const activeWorkspaceId = computed(() => activeId.value ?? undefined);

const reviewStats = useReviewStats({
  workspaceId: activeWorkspaceId,
  immediate: true,
});

const materialsStore = computed(() =>
  activeId.value ? useMaterialsStore(activeId.value) : null
);
const stats = ref<ReviewWorkspaceStats | null>(null);

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

const workspaceAccent = computed(() => {
  const current = activeWorkspace.value;
  if (!current) return "var(--color-primary)";
  const metadata = current.metadata as Record<string, unknown> | null;
  return typeof metadata?.color === "string" && metadata.color.startsWith("--")
    ? `var(${metadata.color})`
    : accentVarFor(current.id);
});

const workspaceStats = computed(() => [
  { label: "Cards", value: stats.value?.total ?? reviewStats.stats.value?.total ?? 0 },
  { label: "Due", value: stats.value?.due ?? reviewStats.stats.value?.due ?? 0 },
  {
    label: "Materials",
    value: materialsStore.value?.materialsList.value.length ?? 0,
  },
]);

type ActivityEvent = {
  key: string;
  icon: string;
  label: string;
  sub: string;
  ts: number;
};
const activity = computed<ActivityEvent[]>(() => {
  if (!materialsStore.value) return [];
  const events: ActivityEvent[] =
    materialsStore.value.materialsList.value.flatMap((material) => {
      const ts = new Date(material.createdAt).getTime();
      return Number.isFinite(ts)
        ? [
            {
              key: `material-${material.id}`,
              icon: "file-stack",
              label: material.title || "Material",
              sub: "Material added",
              ts,
            },
          ]
        : [];
    });
  if (stats.value?.lastReviewedAt) {
    const ts = new Date(stats.value.lastReviewedAt).getTime();
    if (Number.isFinite(ts)) {
      events.push({
        key: "last-review",
        icon: "brain",
        label: "Reviewed cards",
        sub: `${stats.value.total} card${stats.value.total === 1 ? "" : "s"} in this workspace`,
        ts,
      });
    }
  }
  return events.sort((a, b) => b.ts - a.ts).slice(0, 8);
});

function relativeTime(ts: number) {
  const minutes = Math.round((Date.now() - ts) / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(ts).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

function editSpace() {
  if (activeId.value) {
    navigateTo(`/workspaces?edit=${activeId.value}`);
  }
}

async function loadStats() {
  if (!activeId.value) {
    stats.value = null;
    return;
  }
  const response = await $api.review.getStatsBatch([activeId.value]);
  if (response.success) {
    stats.value = response.data.stats[activeId.value] ?? null;
  }
}

async function loadData() {
  if (!activeId.value) return;
  await Promise.allSettled([
    materialsStore.value?.fetchMaterials(),
    loadStats(),
  ]);
}

watch(activeId, () => void loadData(), { immediate: true });
onMounted(() => void loadData());

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

.learning-dashboard__section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.learning-dashboard__identity {
  display: flex;
  align-items: flex-start;
  gap: var(--space-3);
  padding: var(--space-4);
  border: 1px solid var(--color-secondary);
  border-radius: var(--radius-lg);
  background: var(--ds-surface-card);
}

.learning-dashboard__marker {
  width: 6px;
  min-height: 44px;
  align-self: stretch;
  border-radius: var(--radius-full);
}

.learning-dashboard__stats {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: var(--space-2);
}

.learning-dashboard__stat {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-1);
}

.learning-dashboard__stat strong {
  color: var(--color-content-on-surface-strong);
  font-size: var(--text-xl);
}

.learning-dashboard__stat span {
  color: var(--color-content-secondary);
  font-size: var(--text-xs);
}

.learning-dashboard__feed {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  margin: 0;
  padding: 0;
  list-style: none;
}

.learning-dashboard__feed li {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-3);
  border: 1px solid var(--color-secondary);
  border-radius: var(--radius-lg);
}

.learning-dashboard__feed strong,
.learning-dashboard__feed small {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.learning-dashboard__feed strong {
  color: var(--color-content-on-surface-strong);
  font-size: var(--text-sm);
}

.learning-dashboard__feed small,
.learning-dashboard__feed time {
  color: var(--color-content-secondary);
  font-size: var(--text-xs);
}

.learning-dashboard__event-icon {
  display: grid;
  width: 34px;
  height: 34px;
  place-items: center;
  border-radius: var(--radius-lg);
  background: var(--color-primary-soft);
  color: var(--color-primary);
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

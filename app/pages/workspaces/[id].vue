<template>
  <div class="workspace-overview">
    <AppPageHeader
      title="Workspace"
      back-to="/workspaces"
      back-label="Back to workspaces"
    >
      <template #actions>
        <UiIconButton
          icon="i-lucide-pencil"
          label="Edit workspace"
          size="sm"
          variant="soft"
          @click="editSpace"
        />
      </template>
    </AppPageHeader>

    <div v-if="loading && !workspace" class="workspace-overview__loading">
      <UiSkeleton class="h-12 w-12 rounded-[var(--radius-lg)]" />
      <UiSkeleton class="h-6 w-40 rounded-[var(--radius-lg)]" />
      <UiSkeleton class="h-16 w-full rounded-[var(--radius-lg)]" />
    </div>

    <template v-else-if="workspace">
      <section class="workspace-overview__identity">
        <span
          class="workspace-overview__marker"
          :style="{ background: workspaceAccent }"
        />
        <div class="min-w-0 flex-1">
          <UiTitle
            tag="h1"
            size="2xl"
            weight="bold"
            color="content-on-surface-strong"
          >
            {{ workspace.title }}
          </UiTitle>
          <UiParagraph
            v-if="workspace.description"
            size="sm"
            color="content-secondary"
          >
            {{ workspace.description }}
          </UiParagraph>
        </div>
        <UiPill
          label="Private"
          color="var(--color-content-secondary)"
          variant="soft"
        >
          <template #icon
            ><UiPillIcon name="i-lucide-lock" size="sm"
          /></template>
        </UiPill>
      </section>

      <div class="workspace-overview__stats">
        <UiPanel
          v-for="item in workspaceStats"
          :key="item.label"
          variant="subtle"
          size="sm"
        >
          <div class="workspace-overview__stat">
            <strong>{{ item.value }}</strong>
            <span>{{ item.label }}</span>
          </div>
        </UiPanel>
      </div>

      <section class="workspace-overview__activity">
        <UiSubtitle tag="h2" size="sm" weight="semibold"
          >Recent activity</UiSubtitle
        >
        <ul v-if="activity.length" class="workspace-overview__feed">
          <li v-for="item in activity" :key="item.key">
            <span class="workspace-overview__event-icon">
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
          icon="i-lucide-activity"
          title="No learning activity yet"
          description="Add a material or start reviewing in this workspace."
        />
      </section>

      <UiButton block size="lg" @click="activateWorkspace"
        >Use workspace</UiButton
      >
    </template>

    <UiEmptyState
      v-else
      icon="i-lucide-folder-x"
      title="Workspace not found"
      action-label="Back to workspaces"
      @action="navigateTo('/workspaces')"
    />
  </div>
</template>

<script setup lang="ts">
import type { ReviewWorkspaceStats } from "@shared/utils/review.contract";
import AppPageHeader from "~/components/patterns/AppPageHeader.vue";
import { accentVarFor } from "~/composables/useAccentColor";
import { useActiveWorkspace } from "~/composables/workspaces/useActiveWorkspace";
import { useMaterialsStore } from "~/composables/workspaces/useMaterialsStore";
import { useWorkspace } from "~/composables/workspaces/useWorkspaces";

const route = useRoute();
const { $api } = useNuxtApp();
const { setActive } = useActiveWorkspace();
const workspaceId = computed(() => String(route.params.id));
const { workspace, loading } = useWorkspace(workspaceId.value);
const materialsStore = computed(() => useMaterialsStore(workspaceId.value));
const stats = ref<ReviewWorkspaceStats | null>(null);

const workspaceAccent = computed(() => {
  const current = workspace.value;
  if (!current) return "var(--color-primary)";
  const metadata = current.metadata as Record<string, unknown> | null;
  return typeof metadata?.color === "string" && metadata.color.startsWith("--")
    ? `var(${metadata.color})`
    : accentVarFor(current.id);
});
const workspaceStats = computed(() => [
  { label: "Cards", value: stats.value?.total ?? 0 },
  { label: "Due", value: stats.value?.due ?? 0 },
  {
    label: "Materials",
    value: materialsStore.value.materialsList.value.length,
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
  const events: ActivityEvent[] =
    materialsStore.value.materialsList.value.flatMap((material) => {
      const ts = new Date(material.createdAt).getTime();
      return Number.isFinite(ts)
        ? [
            {
              key: `material-${material.id}`,
              icon: "i-lucide-file-stack",
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
        icon: "i-lucide-brain",
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
  navigateTo(`/workspaces?edit=${workspaceId.value}`);
}
function activateWorkspace() {
  setActive(workspaceId.value);
  navigateTo("/learn");
}
async function loadData() {
  await Promise.allSettled([
    materialsStore.value.fetchMaterials(),
    loadStats(),
  ]);
}
async function loadStats() {
  const response = await $api.review.getStatsBatch([workspaceId.value]);
  if (response.success)
    stats.value = response.data.stats[workspaceId.value] ?? null;
}

watch(workspaceId, () => void loadData());
onMounted(() => void loadData());
</script>

<style scoped>
.workspace-overview {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  padding-bottom: var(--space-6);
}
.workspace-overview__loading {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}
.workspace-overview__identity {
  display: flex;
  align-items: flex-start;
  gap: var(--space-3);
  padding: var(--space-4);
  border: 1px solid var(--color-secondary);
  border-radius: var(--radius-lg);
  background: var(--ds-surface-card);
}
.workspace-overview__marker {
  width: 6px;
  min-height: 48px;
  align-self: stretch;
  border-radius: var(--radius-full);
}
.workspace-overview__stats {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: var(--space-2);
}
.workspace-overview__stat {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-1);
}
.workspace-overview__stat strong {
  color: var(--color-content-on-surface-strong);
  font-size: var(--text-xl);
}
.workspace-overview__stat span {
  color: var(--color-content-secondary);
  font-size: var(--text-xs);
}
.workspace-overview__activity {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}
.workspace-overview__feed {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  margin: 0;
  padding: 0;
  list-style: none;
}
.workspace-overview__feed li {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-3);
  border: 1px solid var(--color-secondary);
  border-radius: var(--radius-lg);
}
.workspace-overview__feed strong,
.workspace-overview__feed small {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.workspace-overview__feed strong {
  color: var(--color-content-on-surface-strong);
  font-size: var(--text-sm);
}
.workspace-overview__feed small,
.workspace-overview__feed time {
  color: var(--color-content-secondary);
  font-size: var(--text-xs);
}
.workspace-overview__event-icon {
  display: grid;
  width: 34px;
  height: 34px;
  place-items: center;
  border-radius: var(--radius-lg);
  background: var(--color-primary-soft);
  color: var(--color-primary);
}
</style>

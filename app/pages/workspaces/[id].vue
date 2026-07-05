<template>
  <div class="wso">
    <header class="wso__top">
      <UiIconButton
        class="wso__back"
        icon="i-lucide-chevron-left"
        label="Back to workspaces"
        @click="goBack"
      />
      <UiIconButton
        icon="i-lucide-pencil"
        label="Edit workspace"
        size="sm"
        variant="soft"
        @click="editSpace"
      />
    </header>

    <div v-if="loading && !workspace" class="wso__loading">
      <UiSkeleton class="h-[88px] w-[88px] rounded-[var(--radius-2xl)]" />
      <UiSkeleton class="h-6 w-40 rounded-[var(--radius-lg)]" />
      <UiSkeleton class="h-16 w-full rounded-[var(--radius-2xl)]" />
    </div>

    <template v-else-if="workspace">
      <!-- hero -->
      <section class="wso__hero">
        <div class="wso__tile" :style="{ background: heroGradient }">
          {{ initial(workspace.title) }}
        </div>
        <ui-title tag="h1" class="wso__name">{{ workspace.title }}</ui-title>
        <p v-if="workspace.description" class="wso__desc">
          {{ workspace.description }}
        </p>
        <UiPill
          label="Private space · just you"
          color="var(--color-content-secondary)"
          variant="soft"
          max-width="240px"
        >
          <template #icon>
            <UiPillIcon name="i-lucide-lock" size="sm" />
          </template>
        </UiPill>
      </section>

      <!-- stats -->
      <div class="wso__stats">
        <div class="wso__stat">
          <span class="wso__stat-num">{{ stats?.total ?? 0 }}</span>
          <span class="wso__stat-label">Cards</span>
        </div>
        <div
          class="wso__stat"
          :class="{ 'wso__stat--due': (stats?.due ?? 0) > 0 }"
        >
          <span class="wso__stat-num">{{ stats?.due ?? 0 }}</span>
          <span class="wso__stat-label">Due</span>
        </div>
        <div class="wso__stat">
          <span class="wso__stat-num">{{ notesCount }}</span>
          <span class="wso__stat-label">Notes</span>
        </div>
      </div>

      <!-- recent activity -->
      <section class="wso__activity">
        <ui-title tag="h2" class="wso__section-label">RECENT ACTIVITY</ui-title>
        <ul v-if="activity.length" class="wso__feed">
          <li v-for="item in activity" :key="item.key" class="wso__event">
            <span
              class="wso__event-icon"
              :class="`wso__event-icon--${item.tone}`"
            >
              <UiIcon :name="item.icon" class="h-4 w-4" />
            </span>
            <span class="wso__event-main">
              <span class="wso__event-label">{{ item.label }}</span>
              <span class="wso__event-sub">{{ item.sub }}</span>
            </span>
            <time class="wso__event-time">{{ relativeTime(item.ts) }}</time>
          </li>
        </ul>
        <p v-else class="wso__feed-empty">
          No activity yet — open the space to start adding notes and cards.
        </p>
      </section>

      <UiButton
        pill
        block
        tone="primary"
        size="lg"
        class="wso__open"
        @click="openSpace"
      >
        Open space
      </UiButton>
    </template>

    <div v-else class="wso__missing">
      <UiIcon name="i-lucide-folder-x" class="h-9 w-9 text-content-disabled" />
      <p>Workspace not found.</p>
      <UiButton pill @click="goBack">Back to workspaces</UiButton>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from "vue";
import { useRoute } from "vue-router";
import { useWorkspace } from "~/composables/workspaces/useWorkspaces";
import { useActiveWorkspace } from "~/composables/workspaces/useActiveWorkspace";
import { ACCENT_TOKENS, accentVarFor } from "~/composables/useAccentColor";
import { useNotesStore } from "~/features/notes/composables/useNotesStore";
import { useMaterialsStore } from "~/composables/workspaces/useMaterialsStore";
import type { ReviewWorkspaceStats } from "@shared/utils/review.contract";

const route = useRoute();
const { $api } = useNuxtApp();
const { setActive } = useActiveWorkspace();

const workspaceId = computed(() => String(route.params.id));
const { workspace, loading } = useWorkspace(workspaceId.value);

const notesStore = computed(() => useNotesStore(workspaceId.value));
const materialsStore = computed(() => useMaterialsStore(workspaceId.value));
const stats = ref<ReviewWorkspaceStats | null>(null);

const notesCount = computed(() => notesStore.value.notes.value.size);

// ── Accent gradient (matches the switcher's per-space color) ─────────────────
function initial(name: string) {
  return (name?.trim()?.[0] ?? "W").toUpperCase();
}
function gradientFromToken(token: string) {
  return `linear-gradient(135deg, var(${token}), color-mix(in srgb, var(${token}) 62%, black))`;
}
function accentTokenFromVar(v: string) {
  return v.match(/var\((--[a-z-]+)\)/)?.[1] ?? "--color-accent-indigo";
}
const heroGradient = computed(() => {
  const w = workspace.value;
  if (!w) return gradientFromToken(ACCENT_TOKENS[2]!);
  const meta = w.metadata as Record<string, unknown> | null;
  const token =
    typeof meta?.color === "string" && meta.color.startsWith("--")
      ? meta.color
      : accentTokenFromVar(accentVarFor(w.id));
  return gradientFromToken(token);
});

// ── Recent activity (derived from real data — no presence/members backing) ───
type Event = {
  key: string;
  icon: string;
  tone: string;
  label: string;
  sub: string;
  ts: number;
};

const activity = computed<Event[]>(() => {
  const events: Event[] = [];

  for (const n of notesStore.value.notes.value.values()) {
    const ts = new Date(n.updatedAt).getTime();
    if (!Number.isFinite(ts)) continue;
    events.push({
      key: `note-${n.id}`,
      icon:
        n.noteType === "CANVAS"
          ? "i-lucide-pen-tool"
          : n.noteType === "MATH"
            ? "i-lucide-sigma"
            : "i-lucide-file-text",
      tone: "note",
      label: n.title?.trim() || "Untitled note",
      sub: "Note edited",
      ts,
    });
  }

  for (const m of materialsStore.value.materialsList.value) {
    const ts = new Date(m.createdAt).getTime();
    if (!Number.isFinite(ts)) continue;
    events.push({
      key: `mat-${m.id}`,
      icon: "i-lucide-file-stack",
      tone: "material",
      label: m.title || "Material",
      sub: "Material added",
      ts,
    });
  }

  if (stats.value?.lastReviewedAt) {
    const ts = new Date(stats.value.lastReviewedAt).getTime();
    if (Number.isFinite(ts)) {
      events.push({
        key: "last-review",
        icon: "i-lucide-layers",
        tone: "review",
        label: "Reviewed cards",
        sub: `${stats.value.total} card${stats.value.total === 1 ? "" : "s"} in this space`,
        ts,
      });
    }
  }

  return events.sort((a, b) => b.ts - a.ts).slice(0, 8);
});

function relativeTime(ts: number) {
  const diff = Date.now() - ts;
  const m = Math.round(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(ts).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

// ── Actions ──────────────────────────────────────────────────────────────────
function goBack() {
  navigateTo("/workspaces");
}
function editSpace() {
  navigateTo(`/workspaces?edit=${workspaceId.value}`);
}
function openSpace() {
  setActive(workspaceId.value);
  navigateTo("/notes");
}

async function load() {
  await Promise.allSettled([
    notesStore.value
      .hydrateLocalNotes()
      .then(() => notesStore.value.refreshFromServer()),
    materialsStore.value.fetchMaterials(),
    loadStats(),
  ]);
}
async function loadStats() {
  const res = await $api.review.getStatsBatch([workspaceId.value]);
  if (res.success) stats.value = res.data.stats[workspaceId.value] ?? null;
}

watch(workspaceId, () => load());
onMounted(() => load());
</script>

<style scoped>
.wso {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  padding: var(--space-4) var(--space-4) var(--space-8);
}
.wso__top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-top: var(--space-2);
}
.wso__back {
  margin-left: calc(-1 * var(--space-2));
}
.wso__loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-3);
  padding-top: var(--space-6);
}

/* hero */
.wso__hero {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-2);
  text-align: center;
  padding: var(--space-2) 0 var(--space-1);
}
.wso__tile {
  display: grid;
  place-items: center;
  width: 88px;
  height: 88px;
  border-radius: var(--radius-2xl);
  color: var(--color-white);
  font-size: 38px;
  font-weight: 800;
  box-shadow: var(--shadow-card);
}
.wso__name {
  font-size: 26px;
  font-weight: 800;
  letter-spacing: -0.6px;
  color: var(--color-content-on-surface-strong);
}
.wso__desc {
  font-size: 14px;
  line-height: 1.5;
  color: var(--color-content-secondary);
  max-width: 32ch;
}
/* stats */
.wso__stats {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: var(--space-3);
}
.wso__stat {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  padding: var(--space-3);
  border-radius: var(--radius-2xl);
  background: var(--ds-surface-card);
  border: 1px solid var(--color-secondary);
  box-shadow: var(--shadow-card);
}
.wso__stat--due {
  border-color: color-mix(in srgb, var(--color-primary) 35%, transparent);
  background: color-mix(
    in srgb,
    var(--color-primary) 6%,
    var(--ds-surface-card)
  );
}
.wso__stat-num {
  font-size: 22px;
  font-weight: 800;
  letter-spacing: -0.5px;
  color: var(--color-content-on-surface-strong);
}
.wso__stat--due .wso__stat-num {
  color: var(--color-primary);
}
.wso__stat-label {
  font-size: 11.5px;
  font-weight: 600;
  letter-spacing: 0.3px;
  color: var(--color-content-secondary);
}

/* activity */
.wso__activity {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}
.wso__section-label {
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 1.5px;
  color: var(--color-content-secondary);
}
.wso__feed {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  list-style: none;
  padding: 0;
  margin: 0;
}
.wso__event {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-3);
  border-radius: var(--radius-2xl);
  background: var(--ds-surface-card);
  border: 1px solid var(--color-secondary);
  box-shadow: var(--shadow-card);
}
.wso__event-icon {
  display: grid;
  place-items: center;
  width: 34px;
  height: 34px;
  border-radius: var(--radius-full);
  flex-shrink: 0;
}
.wso__event-icon--note {
  color: var(--color-accent-indigo);
  background: color-mix(in srgb, var(--color-accent-indigo) 12%, transparent);
}
.wso__event-icon--material {
  color: var(--color-accent-orange);
  background: color-mix(in srgb, var(--color-accent-orange) 12%, transparent);
}
.wso__event-icon--review {
  color: var(--color-primary);
  background: color-mix(in srgb, var(--color-primary) 12%, transparent);
}
.wso__event-main {
  display: flex;
  flex-direction: column;
  min-width: 0;
  flex: 1;
}
.wso__event-label {
  font-size: 14px;
  font-weight: 600;
  color: var(--color-content-on-surface-strong);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.wso__event-sub {
  font-size: 12px;
  color: var(--color-content-secondary);
}
.wso__event-time {
  font-size: 11.5px;
  color: var(--color-content-disabled);
  flex-shrink: 0;
}
.wso__feed-empty {
  padding: var(--space-4);
  border-radius: var(--radius-2xl);
  background: var(--color-surface-subtle);
  font-size: 13.5px;
  line-height: 1.5;
  color: var(--color-content-secondary);
  text-align: center;
}
.wso__open {
  margin-top: var(--space-2);
}
.wso__missing {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--space-3);
  min-height: 60dvh;
  text-align: center;
  color: var(--color-content-secondary);
}
</style>

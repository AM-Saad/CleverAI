<template>
  <UiSheet
    :open="isSwitcherOpen"
    title="Switch workspace"
    @update:open="onOpenChange"
  >
    <template #header>
      <div class="wss__head">
        <UiTitle
          tag="h2"
          size="lg"
          weight="bold"
          color="content-on-surface-strong"
          class="wss__title"
        >
          Switch workspace
        </UiTitle>
        <div class="wss__actions">
          <UiButton
            size="xs"
            variant="soft"
            tone="primary"
            icon="plus"
            aria-label="Create new workspace"
            @click="createNew"
          >
            New
          </UiButton>
          <UiButton
            size="xs"
            variant="ghost"
            tone="neutral"
            icon="folder-kanban"
            aria-label="Manage all workspaces"
            @click="openWorkspaces"
          >
            Manage
          </UiButton>
        </div>
      </div>
    </template>

    <div class="wss">
      <!-- recents quick-hop chips -->
      <div v-if="recentChips.length > 1" class="wss__recents">
        <UiPill
          v-for="w in recentChips"
          :key="w.id"
          clickable
          selectable
          :active="w.id === activeId"
          :label="w.title"
          @click="select(w)"
        >
          <template #indicator>
            <UiPillIndicator :color="accentFor(w)" />
          </template>
        </UiPill>
      </div>

      <UiInput
        v-if="workspaces.length > 6"
        v-model="query"
        placeholder="Search workspaces…"
        icon="search"
      />

      <ul class="wss__list">
        <li v-for="w in filtered" :key="w.id">
          <UiListCard
            clickable
            selectable
            :selected="w.id === activeId"
            :title="w.title"
            :description="metaFor(w.id)"
            leading-background="var(--color-surface-subtle)"
            :leading-color="accentFor(w)"
            @click="select(w)"
          >
            <template #leading>
              <span
                class="wss__dot"
                :style="{ background: accentFor(w) }"
                aria-hidden="true"
              />
            </template>
            <template v-if="caughtUp(w.id)" #trailing>
              <UiPill
                size="sm"
                label="caught up"
                color="var(--color-success)"
                variant="outline"
                active
                max-width="120px"
              >
                <template #icon>
                  <UiPillIcon name="check" size="sm" />
                </template>
              </UiPill>
            </template>
            <template v-if="w.id === activeId" #action>
              <UiIcon
                name="check"
                class="h-[18px] w-[18px]"
                aria-hidden="true"
              />
            </template>
          </UiListCard>
        </li>
        <li v-if="!filtered.length" class="wss__empty">
          No workspaces match “{{ query.trim() }}”.
        </li>
      </ul>
    </div>
  </UiSheet>
</template>

<script setup lang="ts">
/**
 * WorkspaceSwitcherSheet — the global quick-switch (module 08). Mounted once in
 * the shell; opened from the header workspace pill on any scoped screen. Tapping
 * a row switches active workspace in place on collection screens. Detail and
 * workspace-home routes navigate so old workspace content never remains visible.
 */
import { ref, computed, watch } from "vue";
import { accentVarFor } from "~/composables/useAccentColor";
import { useActiveWorkspace } from "~/composables/workspaces/useActiveWorkspace";
import type { WorkspaceSummary } from "#shared/utils/workspace.contract";
import type { ReviewWorkspaceStats } from "@shared/utils/review.contract";

const { $api } = useNuxtApp();
const route = useRoute();
const toast = useToast();
const {
  workspaces: wsList,
  recentWorkspaces,
  activeId,
  setActive,
  isSwitcherOpen,
  closeSwitcher,
} = useActiveWorkspace();

const workspaces = computed<WorkspaceSummary[]>(() => wsList.value ?? []);
const query = ref("");
const statsById = ref<Record<string, ReviewWorkspaceStats>>({});

const filtered = computed(() => {
  const q = query.value.trim().toLowerCase();
  const base = recentWorkspaces.value;
  if (!q) return base;
  return base.filter((w) => w.title.toLowerCase().includes(q));
});
const recentChips = computed(() => recentWorkspaces.value.slice(0, 4));

function accentTokenFromVar(v: string) {
  return v.match(/var\((--[a-z-]+)\)/)?.[1] ?? "--color-accent-indigo";
}
function tokenFor(w: WorkspaceSummary) {
  const meta = w.metadata as Record<string, unknown> | null;
  return typeof meta?.color === "string" && meta.color.startsWith("--")
    ? meta.color
    : accentTokenFromVar(accentVarFor(w.id));
}
function accentFor(w: WorkspaceSummary) {
  return `var(${tokenFor(w)})`;
}
function metaFor(id: string) {
  const s = statsById.value[id];
  if (!s) return "—";
  return `${s.total} card${s.total === 1 ? "" : "s"} · ${s.due} due`;
}
function caughtUp(id: string) {
  const s = statsById.value[id];
  return !!s && s.total > 0 && s.due === 0;
}

async function select(w: WorkspaceSummary) {
  const changed = w.id !== activeId.value;
  if (changed) {
    setActive(w.id);
    toast.add({ title: `Switched to ${w.title}`, color: "neutral" });
  }
  closeSwitcher();

  if (!changed) return;
  if (/^\/workspaces\/[^/]+$/.test(route.path)) {
    await navigateTo(`/workspaces/${w.id}`);
    return;
  }
  if (/^\/materials\/[^/]+$/.test(route.path)) {
    await navigateTo("/materials");
  }
}
function createNew() {
  closeSwitcher();
  navigateTo("/workspaces?new=1");
}
function openWorkspaces() {
  closeSwitcher();
  navigateTo("/workspaces");
}
function onOpenChange(v: boolean) {
  if (!v) closeSwitcher();
}

async function loadStats() {
  const ids = workspaces.value.map((w) => w.id);
  if (!ids.length) return;
  const res = await $api.review.getStatsBatch(ids);
  if (!isSwitcherOpen.value) return; // closed mid-flight — skip the re-render
  if (res.success) statsById.value = res.data.stats;
}

// On each open: reset search and load stats (deferred so the fetch's re-render
// can't interrupt the opening transition).
watch(isSwitcherOpen, (open) => {
  if (open) {
    query.value = "";
    setTimeout(loadStats, 360);
  }
});
</script>

<style scoped>
.wss__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
  width: 100%;
}

.wss__title {
  letter-spacing: -0.3px;
}

.wss__actions {
  display: flex;
  align-items: center;
  gap: var(--space-1, 6px);
  flex-shrink: 0;
}

.wss {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  padding-bottom: var(--space-2);
}

.wss__recents {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
}

.wss__list {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  list-style: none;
  padding: 0;
  margin: 0;
}

.wss__dot {
  width: 10px;
  height: 10px;
  border-radius: var(--radius-full);
}

.wss__empty {
  padding: var(--space-4);
  text-align: center;
  font-size: 13.5px;
  color: var(--color-content-secondary);
}
</style>

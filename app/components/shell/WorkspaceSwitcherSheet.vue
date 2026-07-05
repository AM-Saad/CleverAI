<template>
  <UiSheet
    :open="isSwitcherOpen"
    title="Switch workspace"
    @update:open="onOpenChange"
  >
    <div class="wss">
      <!-- recents quick-hop chips -->
      <div v-if="recentChips.length > 1" class="wss__recents">
        <UiPill
          v-for="w in recentChips"
          :key="w.id"
          clickable
          selectable
          variant="outline"
          :active="w.id === activeId"
          :label="w.title"
          :color="accentFor(w)"
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
        icon="i-lucide-search"
      />

      <ul class="wss__list">
        <li v-for="w in filtered" :key="w.id">
          <UiListCard
            clickable
            selectable
            :selected="w.id === activeId"
            :title="w.title"
            :description="metaFor(w.id)"
            :leading-background="gradientFor(w)"
            leading-color="var(--color-white)"
            @click="select(w)"
          >
            <template #leading>
              <span class="wss__initial" aria-hidden="true">{{
                initial(w.title)
              }}</span>
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
                  <UiPillIcon name="i-lucide-check" size="sm" />
                </template>
              </UiPill>
            </template>
            <template v-if="w.id === activeId" #action>
              <UiIcon
                name="i-lucide-check"
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

      <UiListCard
        clickable
        variant="dashed"
        title="New workspace"
        leading-color="var(--color-primary)"
        @click="createNew"
      >
        <template #leading>
          <UiIcon name="i-lucide-plus" class="h-4 w-4" aria-hidden="true" />
        </template>
      </UiListCard>
      <UiListCard
        clickable
        variant="soft"
        title="Manage all workspaces"
        leading-color="var(--color-content-secondary)"
        @click="openWorkspaces"
      >
        <template #leading>
          <UiIcon
            name="i-lucide-folder-kanban"
            class="h-4 w-4"
            aria-hidden="true"
          />
        </template>
        <template #action>
          <UiIcon
            name="i-lucide-chevron-right"
            class="h-4 w-4"
            aria-hidden="true"
          />
        </template>
      </UiListCard>
    </div>
  </UiSheet>
</template>

<script setup lang="ts">
/**
 * WorkspaceSwitcherSheet — the global quick-switch (module 08). Mounted once in
 * the shell; opened from the header workspace pill on any scoped screen. Tapping
 * a row switches the active workspace IN PLACE (every scoped screen reacts to
 * activeId) — no navigation. Management (edit/delete/reorder) stays on /workspaces.
 */
import { ref, computed, watch } from "vue";
import { ACCENT_TOKENS, accentVarFor } from "~/composables/useAccentColor";
import { useActiveWorkspace } from "~/composables/workspaces/useActiveWorkspace";
import type { Workspace } from "#shared/utils/workspace.contract";
import type { ReviewWorkspaceStats } from "@shared/utils/review.contract";

const { $api } = useNuxtApp();
const toast = useToast();
const {
  workspaces: wsList,
  recentWorkspaces,
  activeId,
  setActive,
  isSwitcherOpen,
  closeSwitcher,
} = useActiveWorkspace();

const workspaces = computed<Workspace[]>(() => wsList.value ?? []);
const query = ref("");
const statsById = ref<Record<string, ReviewWorkspaceStats>>({});

const filtered = computed(() => {
  const q = query.value.trim().toLowerCase();
  const base = recentWorkspaces.value;
  if (!q) return base;
  return base.filter((w) => w.title.toLowerCase().includes(q));
});
const recentChips = computed(() => recentWorkspaces.value.slice(0, 4));

function initial(name: string) {
  return (name?.trim()?.[0] ?? "W").toUpperCase();
}
function gradientFromToken(token: string) {
  return `linear-gradient(135deg, var(${token}), color-mix(in srgb, var(${token}) 62%, black))`;
}
function accentTokenFromVar(v: string) {
  return v.match(/var\((--[a-z-]+)\)/)?.[1] ?? "--color-accent-indigo";
}
function tokenFor(w: Workspace) {
  const meta = w.metadata as Record<string, unknown> | null;
  return typeof meta?.color === "string" && meta.color.startsWith("--")
    ? meta.color
    : accentTokenFromVar(accentVarFor(w.id));
}
function gradientFor(w: Workspace) {
  return gradientFromToken(tokenFor(w));
}
function accentFor(w: Workspace) {
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

function select(w: Workspace) {
  if (w.id !== activeId.value) {
    setActive(w.id);
    toast.add({ title: `Switched to ${w.title}`, color: "neutral" });
  }
  closeSwitcher();
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

// Silence unused-import lint; ACCENT_TOKENS kept for parity with the switcher page.
void ACCENT_TOKENS;
</script>

<style scoped>
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
.wss__initial {
  font-weight: 800;
  font-size: 17px;
}
.wss__empty {
  padding: var(--space-4);
  text-align: center;
  font-size: 13.5px;
  color: var(--color-content-secondary);
}
</style>

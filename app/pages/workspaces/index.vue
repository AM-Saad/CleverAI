<template>
  <div class="ws">
    <header class="ws__header">
      <UiIconButton
        class="ws__back"
        icon="i-lucide-chevron-left"
        label="Back"
        @click="goBack"
      />
      <div>
        <ui-title tag="h1" class="ws__title">Workspaces</ui-title>
        <p class="ws__sub">
          {{ workspaces.length }} workspace{{
            workspaces.length === 1 ? "" : "s"
          }}
        </p>
      </div>
    </header>

    <div v-if="loading && !workspaces.length" class="ws__list">
      <UiSkeleton
        v-for="i in 3"
        :key="i"
        class="h-[68px] w-full rounded-[var(--radius-2xl)]"
      />
    </div>

    <ul v-else class="ws__list">
      <li
        v-for="w in workspaces"
        :key="w.id"
        class="ws__row"
        :class="{ 'ws__row--active': w.id === activeId }"
      >
        <button type="button" class="ws__row-select" @click="select(w.id)">
          <!-- design-allow: native selectable workspace row -->
          <span class="ws__tile" :style="{ background: gradientFor(w) }">{{
            initial(w.title)
          }}</span>
          <span class="ws__row-main">
            <span class="ws__row-name">{{ w.title }}</span>
            <span class="ws__row-meta">{{ metaFor(w.id) }}</span>
          </span>
        </button>
        <UiPill
          v-if="caughtUp(w.id)"
          size="sm"
          label="all caught up"
          color="var(--color-success)"
          variant="outline"
          active
          max-width="132px"
        >
          <template #icon>
            <UiPillIcon name="i-lucide-check" size="sm" />
          </template>
        </UiPill>
        <UiIcon
          v-if="w.id === activeId"
          name="i-lucide-circle-check-big"
          class="ws__active-icon"
        />
        <UiIconButton
          icon="i-lucide-more-vertical"
          label="Workspace actions"
          size="sm"
          @click="openActions(w)"
        />
      </li>

      <li>
        <button type="button" class="ws__new" @click="startCreate">
          <!-- design-allow: native dashed add control -->
          <UiIcon name="i-lucide-plus" class="h-4 w-4" />
          New workspace
        </button>
      </li>
    </ul>

    <!-- workspace actions (⋯) -->
    <UiSheet
      v-model:open="actionsOpen"
      :title="actionTarget?.title ?? 'Workspace'"
    >
      <div class="ws-actions">
        <UiListCard
          clickable
          variant="soft"
          title="Overview"
          @click="openOverview"
        >
          <template #leading>
            <UiIcon name="i-lucide-layout-dashboard" class="h-5 w-5" />
          </template>
        </UiListCard>
        <UiListCard
          clickable
          variant="soft"
          title="Open space"
          @click="openSelected"
        >
          <template #leading>
            <UiIcon name="i-lucide-arrow-up-right" class="h-5 w-5" />
          </template>
        </UiListCard>
        <UiListCard clickable variant="soft" title="Edit" @click="startEdit">
          <template #leading>
            <UiIcon name="i-lucide-pencil" class="h-5 w-5" />
          </template>
        </UiListCard>
        <UiDoubleTapDeleteButton
          unstyled
          class="ws-actions__row ws-actions__row--danger"
          label="Delete workspace"
          armed-label="Tap again to delete workspace"
          :reset-key="actionTarget?.id ?? null"
          @confirm="onDeleteTap"
        >
          <template #default="{ label }">
            <UiIcon name="i-lucide-trash-2" class="h-5 w-5" />
            {{ label }}
          </template>
        </UiDoubleTapDeleteButton>
      </div>
    </UiSheet>

    <!-- create / edit flow -->
    <UiSheet
      v-model:open="createOpen"
      :title="editingId ? 'Edit workspace' : 'New workspace'"
    >
      <div class="ws-create">
        <div
          class="ws-create__preview"
          :style="{ background: previewGradient }"
        >
          {{ initial(form.title || "W") }}
        </div>

        <div class="ws-create__swatches">
          <button
            v-for="c in accentTokens"
            :key="c"
            type="button"
            class="ws-create__swatch"
            :class="{ 'ws-create__swatch--on': form.color === c }"
            :style="{ background: `var(${c})` }"
            :aria-label="`Color ${c}`"
            @click="form.color = c"
          />
          <!-- design-allow: native color swatch -->
        </div>

        <label class="ws-create__label">NAME</label>
        <UiInput v-model="form.title" placeholder="e.g. Biology" autofocus />

        <label class="ws-create__label">DESCRIPTION (optional)</label>
        <UiTextarea
          v-model="form.description"
          placeholder="What's this space for?"
          :rows="2"
        />

        <div class="ws-create__info">
          <UiIcon name="i-lucide-users" class="h-4 w-4" />
          You can invite collaborators after creating.
        </div>
      </div>

      <template #footer>
        <UiButton
          pill
          block
          tone="primary"
          size="lg"
          :loading="creating || updating"
          :disabled="!form.title.trim()"
          @click="submit"
        >
          {{ editingId ? "Save changes" : "Create workspace" }}
        </UiButton>
      </template>
    </UiSheet>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, watch } from "vue";
import { ACCENT_TOKENS, accentVarFor } from "~/composables/useAccentColor";
import { useActiveWorkspace } from "~/composables/workspaces/useActiveWorkspace";
import {
  useCreateWorkspace,
  useUpdateWorkspace,
  useDeleteWorkspace,
} from "~/composables/workspaces/useWorkspaces";
import type { WorkspaceSummary } from "#shared/utils/workspace.contract";
import type { ReviewWorkspaceStats } from "@shared/utils/review.contract";

const { $api } = useNuxtApp();
const route = useRoute();
const toast = useToast();
const {
  workspaces: wsList,
  loading,
  activeId,
  setActive,
  refresh,
} = useActiveWorkspace();
const { createWorkspace, creating } = useCreateWorkspace(refresh);
const { updateWorkspace, updating } = useUpdateWorkspace();
const { deleteWorkspace } = useDeleteWorkspace(refresh);

const workspaces = computed<WorkspaceSummary[]>(() => wsList.value ?? []);
const createOpen = ref(false);
const accentTokens = ACCENT_TOKENS;
const statsById = ref<Record<string, ReviewWorkspaceStats>>({});
const workspaceIdsKey = computed(() => workspaces.value.map((w) => w.id).join(","));
const handledEditId = ref<string | null>(null);
const handledNewIntent = ref(false);

// Row actions / edit state
const actionsOpen = ref(false);
const actionTarget = ref<WorkspaceSummary | null>(null);
const editingId = ref<string | null>(null);

const form = reactive({
  title: "",
  description: "",
  color: ACCENT_TOKENS[2] as string,
});
const previewGradient = computed(() => gradientFromToken(form.color));

function initial(name: string) {
  return (name?.trim()?.[0] ?? "W").toUpperCase();
}
function gradientFromToken(token: string) {
  return `linear-gradient(135deg, var(${token}), color-mix(in srgb, var(${token}) 62%, black))`;
}
function gradientFor(w: WorkspaceSummary) {
  const meta = w.metadata as Record<string, unknown> | null;
  const token =
    typeof meta?.color === "string" && meta.color.startsWith("--")
      ? meta.color
      : accentTokenFromVar(accentVarFor(w.id));
  return gradientFromToken(token);
}
function accentTokenFromVar(v: string) {
  return v.match(/var\((--[a-z-]+)\)/)?.[1] ?? "--color-accent-indigo";
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

function select(id: string) {
  setActive(id);
  navigateTo("/notes");
}
function goBack() {
  navigateTo("/");
}

async function submit() {
  if (!form.title.trim()) return;
  if (editingId.value) {
    const updated = await updateWorkspace({
      id: editingId.value,
      title: form.title.trim(),
      description: form.description.trim() || undefined,
      metadata: { color: form.color },
    });
    if (updated) {
      createOpen.value = false;
      editingId.value = null;
      await refresh();
    }
    return;
  }
  const created = await createWorkspace({
    title: form.title.trim(),
    description: form.description.trim() || undefined,
    metadata: { color: form.color },
  });
  if (created) {
    createOpen.value = false;
    form.title = "";
    form.description = "";
    setActive(created.id);
    await loadStats();
  }
}

function startCreate() {
  editingId.value = null;
  form.title = "";
  form.description = "";
  form.color = ACCENT_TOKENS[2];
  createOpen.value = true;
}

// ── Row actions ─────────────────────────────────────────────────────────────
function openActions(w: WorkspaceSummary) {
  actionTarget.value = w;
  actionsOpen.value = true;
}
function openSelected() {
  if (actionTarget.value) select(actionTarget.value.id);
  actionsOpen.value = false;
}
function openOverview() {
  const w = actionTarget.value;
  actionsOpen.value = false;
  if (w) navigateTo(`/workspaces/${w.id}`);
}
function startEdit() {
  const w = actionTarget.value;
  if (!w) return;
  editingId.value = w.id;
  form.title = w.title;
  form.description = w.description ?? "";
  const meta = w.metadata as Record<string, unknown> | null;
  form.color =
    typeof meta?.color === "string" && meta.color.startsWith("--")
      ? meta.color
      : ACCENT_TOKENS[2];
  actionsOpen.value = false;
  createOpen.value = true;
}
async function onDeleteTap() {
  const w = actionTarget.value;
  if (!w) return;
  await deleteWorkspace(w.id);
  actionsOpen.value = false;
  toast.add({ title: "Workspace deleted", color: "neutral" });
  await loadStats();
}

async function loadStats() {
  const ids = workspaces.value.map((w) => w.id);
  if (!ids.length) {
    statsById.value = {};
    return;
  }
  const res = await $api.review.getStatsBatch(ids);
  if (res.success) statsById.value = res.data.stats;
}

function handleRouteIntents() {
  // Deep-link from the workspace overview's edit button.
  const editId = route.query.edit as string | undefined;
  if (editId && handledEditId.value !== editId) {
    const w = workspaces.value.find((x) => x.id === editId);
    if (w) {
      actionTarget.value = w;
      handledEditId.value = editId;
      startEdit();
    }
  }
  // Deep-link from the quick-switcher's "New workspace".
  if (route.query.new && !handledNewIntent.value) {
    handledNewIntent.value = true;
    startCreate();
  }
}

watch(workspaceIdsKey, () => {
  void loadStats();
}, { immediate: true });

watch(
  [workspaces, () => route.query.edit, () => route.query.new],
  handleRouteIntents,
  { immediate: true },
);
</script>

<style scoped>
.ws {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  padding: var(--space-4) var(--space-4) var(--space-8);
}
.ws__header {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding-top: var(--space-2);
}
.ws__back {
  margin-left: calc(-1 * var(--space-2));
}
.ws__title {
  font-size: 24px;
  font-weight: 800;
  letter-spacing: -0.6px;
  color: var(--color-content-on-surface-strong);
}
.ws__sub {
  font-size: 13px;
  color: var(--color-content-secondary);
}
.ws__list {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  list-style: none;
  padding: 0;
  margin: 0;
}
.ws__row {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  width: 100%;
  padding: var(--space-3);
  border-radius: var(--radius-2xl);
  background: var(--ds-surface-card);
  border: 1px solid var(--color-secondary);
  box-shadow: var(--shadow-card);
  text-align: left;
}
.ws__row--active {
  border-width: 1.5px;
  border-color: var(--color-primary);
  background: color-mix(in srgb, var(--color-primary) 6%, transparent);
}
.ws__row-select {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  flex: 1;
  min-width: 0;
  background: transparent;
  text-align: left;
}
.ws-actions {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  padding-bottom: var(--space-2);
}
.ws-actions__row {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  width: 100%;
  padding: var(--space-3) var(--space-4);
  border-radius: var(--radius-xl);
  font-size: 15px;
  font-weight: 600;
  color: var(--color-content-on-surface-strong);
  background: var(--color-surface-subtle);
}
.ws-actions__row--danger {
  color: var(--color-error-text);
  background: color-mix(in srgb, var(--color-error) 10%, transparent);
}
.ws__tile {
  display: grid;
  place-items: center;
  width: 44px;
  height: 44px;
  border-radius: var(--radius-xl);
  color: var(--color-white);
  font-weight: 800;
  font-size: 18px;
  flex-shrink: 0;
}
.ws__row-main {
  display: flex;
  flex-direction: column;
  min-width: 0;
  flex: 1;
}
.ws__row-name {
  font-size: 15px;
  font-weight: 700;
  letter-spacing: -0.2px;
  color: var(--color-content-on-surface-strong);
}
.ws__row-meta {
  font-size: 12.5px;
  color: var(--color-content-secondary);
}
.ws__active-icon {
  width: 22px;
  height: 22px;
  color: var(--color-primary);
  flex-shrink: 0;
}
.ws__new {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  width: 100%;
  padding: 13px;
  border-radius: var(--radius-2xl);
  border: 1.5px dashed var(--color-border-strong);
  color: var(--color-primary);
  font-size: 14px;
  font-weight: 600;
}
.ws__new:active {
  background: var(--color-surface-subtle);
}

.ws-create {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  padding-bottom: var(--space-2);
}
.ws-create__preview {
  display: grid;
  place-items: center;
  width: 72px;
  height: 72px;
  margin: var(--space-2) auto var(--space-3);
  border-radius: var(--radius-2xl);
  color: var(--color-white);
  font-size: 30px;
  font-weight: 800;
}
.ws-create__swatches {
  display: flex;
  justify-content: center;
  gap: var(--space-2);
  margin-bottom: var(--space-3);
}
.ws-create__swatch {
  width: 28px;
  height: 28px;
  border-radius: var(--radius-full);
  border: 2px solid transparent;
}
.ws-create__swatch--on {
  border-color: var(--color-content-on-surface-strong);
  transform: scale(1.1);
}
.ws-create__label {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 1.5px;
  color: var(--color-content-secondary);
  margin-top: var(--space-2);
}
.ws-create__info {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: var(--space-3);
  padding: var(--space-3);
  border-radius: var(--radius-xl);
  background: var(--color-surface-subtle);
  color: var(--color-content-secondary);
  font-size: 12.5px;
}
</style>

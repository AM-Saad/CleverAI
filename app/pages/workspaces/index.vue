<template>
  <div class="ws">
    <AppPageHeader title="Workspaces" subtitle="Choose a workspace to continue" back-to="/learn" />

    <div v-if="loading && !workspaces.length" class="ws__list">
      <UiSkeleton v-for="i in 3" :key="i" class="h-[68px] w-full rounded-[var(--component-card-radius)]" />
    </div>

    <UiEmptyState v-else-if="workspaceError" icon="triangle-alert" title="Couldn't load your workspaces"
      :description="workspaceErrorMessage" action-label="Try again" @action="refresh" />

    <UiEmptyState v-else-if="!workspaces.length" icon="layers" title="Create your first workspace"
      description="Give one subject, course, or project a focused home for its materials and study tools."
      action-label="New workspace" action-icon="plus" @action="startCreate" />

    <ul v-else class="ws__list">
      <li v-for="w in workspaces" :key="w.id" class="ws__row">
        <UiListCard clickable selectable :selected="w.id === activeId" :title="w.title" :description="metaFor(w)"
          class-name="ws__row-select" @click="select(w.id)">
          <template #leading>
            <span class="ws__tile" :style="{ background: workspaceColor(w) }" />
          </template>
          <template #action>
            <UiIconButton icon="more-vertical" :label="`Actions for ${w.title}`" size="sm" tone="neutral"
              variant="ghost" @click="openActions(w)" />
          </template>
        </UiListCard>

      </li>

      <li>
        <UiListCard clickable variant="dashed" title="New workspace" @click="startCreate">
          <template #leading>
            <UiIcon name="plus" class="h-4 w-4" />
          </template>
        </UiListCard>
      </li>
    </ul>

    <!-- workspace actions (⋯) -->
    <UiSheet v-model:open="actionsOpen" :title="actionTarget?.title ?? 'Workspace'">
      <div class="ws-actions">
        <UiListCard clickable variant="soft" title="Open workspace" @click="openSelected">
          <template #leading>
            <UiIcon name="arrow-right" class="h-5 w-5" />
          </template>
        </UiListCard>
        <UiListCard clickable variant="soft" title="Edit" @click="startEdit">
          <template #leading>
            <UiIcon name="pencil" class="h-5 w-5" />
          </template>
        </UiListCard>
        <UiDoubleTapDeleteButton unstyled class="ws-actions__row ws-actions__row--danger" label="Delete workspace"
          armed-label="Tap again to delete workspace" :reset-key="actionTarget?.id ?? null" @confirm="onDeleteTap">
          <template #default="{ label }">
            <UiIcon name="trash-2" class="h-5 w-5" />
            {{ label }}
          </template>
        </UiDoubleTapDeleteButton>
      </div>
    </UiSheet>

    <!-- create / edit flow -->
    <UiSheet v-model:open="createOpen" :title="editingId ? 'Edit workspace' : 'New workspace'">
      <div class="ws-create">
        <div class="ws-create__preview" :style="{ background: `var(${form.color})` }" />

        <div class="ws-create__swatches">
          <button v-for="c in accentTokens" :key="c" type="button" class="ws-create__swatch"
            :class="{ 'ws-create__swatch--on': form.color === c }" :style="{ background: `var(${c})` }"
            :aria-label="`Color ${c}`" :aria-pressed="form.color === c" @click="form.color = c" />
          <!-- design-allow: native color swatch -->
        </div>

        <UiLabel tag="label" class="ws-create__label" for="workspace-name">NAME</UiLabel>
        <UiInput id="workspace-name" v-model="form.title" placeholder="e.g. Biology" autofocus />

        <UiLabel tag="label" class="ws-create__label" for="workspace-description">DESCRIPTION (optional)</UiLabel>
        <UiTextarea id="workspace-description" v-model="form.description" placeholder="What's this space for?"
          :rows="2" />

        <div class="ws-create__info">
          <UiIcon name="users" class="h-4 w-4" />
          You can invite collaborators after creating.
        </div>
      </div>

      <template #footer>
        <UiButton block tone="primary" size="lg" :loading="creating || updating" :disabled="!form.title.trim()"
          @click="submit">
          {{ editingId ? "Save changes" : "Create workspace" }}
        </UiButton>
      </template>
    </UiSheet>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, watch } from "vue";
import AppPageHeader from "~/components/patterns/AppPageHeader.vue";
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
  error: workspaceError,
  activeId,
  setActive,
  refresh,
} = useActiveWorkspace();
const { createWorkspace, creating } = useCreateWorkspace(refresh);
const { updateWorkspace, updating } = useUpdateWorkspace();
const { deleteWorkspace } = useDeleteWorkspace(refresh);

const workspaces = computed<WorkspaceSummary[]>(() => wsList.value ?? []);
const workspaceErrorMessage = computed(
  () =>
    workspaceError.value?.message ??
    "Check your connection and try loading your workspaces again.",
);
const createOpen = ref(false);
const accentTokens = ACCENT_TOKENS;
const statsById = ref<Record<string, ReviewWorkspaceStats>>({});
const workspaceIdsKey = computed(() =>
  workspaces.value.map((w) => w.id).join(","),
);
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
function workspaceColor(w: WorkspaceSummary) {
  const meta = w.metadata as Record<string, unknown> | null;
  const token =
    typeof meta?.color === "string" && meta.color.startsWith("--")
      ? meta.color
      : accentTokenFromVar(accentVarFor(w.id));
  return `var(${token})`;
}
function accentTokenFromVar(v: string) {
  return v.match(/var\((--[a-z-]+)\)/)?.[1] ?? "--color-accent-indigo";
}
function metaFor(workspace: WorkspaceSummary) {
  const stats = statsById.value[workspace.id];
  if (stats?.due) {
    return `${stats.due} ${stats.due === 1 ? "card" : "cards"} ready to review`;
  }
  if (workspace.description?.trim()) return workspace.description;
  if (stats?.total) return "Review is up to date";
  return "Add materials and create study content";
}

function select(id: string) {
  setActive(id);
  navigateTo(`/workspaces/${id}`);
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
    await navigateTo(`/workspaces/${created.id}`);
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

watch(
  workspaceIdsKey,
  () => {
    void loadStats();
  },
  { immediate: true },
);

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
  gap: var(--space-3);
  padding-bottom: var(--space-6);
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
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: var(--space-1);
  width: 100%;
  text-align: left;
}

.ws__row-select {
  flex: 1;
  min-width: 0;
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
  border-radius: var(--component-card-radius);
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
  width: 12px;
  height: 12px;
  border-radius: var(--radius-full);
  flex-shrink: 0;
}

.ws__active-icon {
  width: 22px;
  height: 22px;
  color: var(--color-primary);
  flex-shrink: 0;
}

.ws-create {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  padding-bottom: var(--space-2);
}

.ws-create__preview {
  width: 40px;
  height: 6px;
  margin: var(--space-2) auto;
  border-radius: var(--radius-full);
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

.ws-create__swatch:focus-visible {
  outline: 2px solid var(--ds-focus-outline-color);
  outline-offset: 2px;
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
  border-radius: var(--component-card-radius);
  background: var(--color-surface-subtle);
  color: var(--color-content-secondary);
  font-size: 12.5px;
}
</style>

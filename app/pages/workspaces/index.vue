<script setup lang="ts">
import type { Workspace } from "@@/shared/utils/workspace.contract";
import { useWorkspaceGenerate } from "~/composables/workspaces/useWorkspaceGenerate";
import { useWorkspaceReviewStats } from "~/features/review/composables/useWorkspaceReviewStats";
import IntegrationAppsIcon from "~/features/integrations/components/IntegrationAppsIcon.vue";
import WorkspaceImportDialog from "~/features/integrations/components/WorkspaceImportDialog.vue";
import LanguageStatusCard from "~/features/language-learning/components/LanguageStatusCard.vue";
import QuickCaptureModal from "~/features/language-learning/components/QuickCaptureModal.vue";
import ReviewStatusCard from "~/features/review/components/ReviewStatusCard.vue";

const toast = useToast();
const show = ref(false);
const searchQuery = ref("");

const showDeleteConfirm = ref(false);
const workspaceToDelete = ref<string | null>(null);
const editWorkspace = ref<Workspace | null>(null);
const {
  isOpen: isQuickCaptureOpen,
  open: openQuickCapture,
  close: closeQuickCapture,
} = useQuickCaptureModal();
const { workspaces, loading, error, refresh } = useWorkspaces();
const { deleteWorkspace, deleting: deletingWorkspace } =
  useDeleteWorkspace(refresh);
const { generatingId, materialsWithoutCards, generateForWorkspace } =
  useWorkspaceGenerate(refresh);

const workspaceIds = computed(() => (workspaces.value ?? []).map((w) => w.id));
const { statsFor, masteryFor } = useWorkspaceReviewStats(workspaceIds);

const STALE_DAYS = 14;

type SortKey = "due" | "recent" | "az" | "cards";
const sortBy = ref<SortKey>("due");
const sortOptions: { value: SortKey; label: string }[] = [
  { value: "due", label: "Due first" },
  { value: "recent", label: "Recent" },
  { value: "az", label: "A–Z" },
  { value: "cards", label: "Most cards" },
];

const filteredWorkspaces = computed(() => {
  const query = searchQuery.value.trim().toLowerCase();
  const list = workspaces.value ?? [];
  if (!query) return list;

  return list.filter((workspace) =>
    [workspace.title, workspace.description]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(query)),
  );
});

const byRecent = (a: Workspace, b: Workspace) =>
  new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();

const sortedWorkspaces = computed(() => {
  const list = [...filteredWorkspaces.value];
  if (sortBy.value === "az") {
    return list.sort((a, b) => a.title.localeCompare(b.title));
  }
  if (sortBy.value === "cards") {
    return list.sort(
      (a, b) => (b.flashcards?.length ?? 0) - (a.flashcards?.length ?? 0),
    );
  }
  if (sortBy.value === "due") {
    return list.sort((a, b) => {
      const diff = dueCount(b) - dueCount(a);
      return diff !== 0 ? diff : byRecent(a, b);
    });
  }
  return list.sort(byRecent);
});

// --- Review-derived signals (populated by the batch stats endpoint) ---
function dueCount(workspace: Workspace) {
  return statsFor(workspace.id)?.due ?? 0;
}

function isStale(workspace: Workspace) {
  const stats = statsFor(workspace.id);
  if (!stats || stats.total === 0 || dueCount(workspace) > 0) return false;
  if (!stats.lastReviewedAt) return false;
  const age = Date.now() - new Date(stats.lastReviewedAt).getTime();
  return age > STALE_DAYS * 86_400_000;
}

// Contextual next-best-action: due cards → review, uncovered materials →
// generate, long-untouched → refresh, otherwise just open.
type RowAction = "review" | "generate" | "refresh" | "open";
function rowAction(workspace: Workspace): RowAction {
  if (dueCount(workspace) > 0) return "review";
  if (workspaceGap(workspace) > 0) return "generate";
  if (isStale(workspace)) return "refresh";
  return "open";
}

// Hero: the workspace with the most cards due right now.
const continueWorkspace = computed(() => {
  let best: Workspace | null = null;
  let bestDue = 0;
  for (const ws of workspaces.value ?? []) {
    const due = statsFor(ws.id)?.due ?? 0;
    if (due > bestDue) {
      bestDue = due;
      best = ws;
    }
  }
  return best ? { workspace: best, due: bestDue } : null;
});

const totalDue = computed(() =>
  (workspaces.value ?? []).reduce((sum, ws) => sum + (statsFor(ws.id)?.due ?? 0), 0),
);

const workspaceTotals = computed(() => {
  const list = workspaces.value ?? [];
  return list.reduce(
    (acc, workspace) => {
      acc.materials += workspace.materials?.length ?? 0;
      acc.flashcards += workspace.flashcards?.length ?? 0;
      acc.questions += workspace.questions?.length ?? 0;
      return acc;
    },
    { materials: 0, flashcards: 0, questions: 0 },
  );
});

const hasWorkspaces = computed(() => (workspaces.value?.length ?? 0) > 0);
const visibleWorkspaceCount = computed(() => filteredWorkspaces.value.length);

const quickSettingsLinks = [
  {
    label: "Account",
    description: "Profile and identity",
    icon: "i-lucide-user",
    to: "/user/settings",
  },
  {
    label: "Language",
    description: "Capture and review preferences",
    icon: "i-lucide-languages",
    to: "/language/settings",
  },
  {
    label: "Study",
    description: "Review session defaults",
    icon: "i-lucide-graduation-cap",
    to: "/user/settings",
  },
  {
    label: "Notifications",
    description: "Reminders and alerts",
    icon: "i-lucide-bell",
    to: "/user/settings",
  },
];

watch(error, (newError) => {
  if (newError) {
    toast.add({
      title: "Error",
      description: newError.message,
    });
  }
});

const openCreateWorkspace = () => {
  editWorkspace.value = null;
  show.value = true;
};

const cancelUpsertModal = () => {
  show.value = false;
  editWorkspace.value = null;
};

const requestDeleteWorkspace = (workspaceId: string) => {
  workspaceToDelete.value = workspaceId;
  showDeleteConfirm.value = true;
};

const confirmDeleteWorkspace = async () => {
  if (!workspaceToDelete.value) return;
  try {
    await deleteWorkspace(workspaceToDelete.value);
    toast.add({
      title: "Workspace Deleted",
      description: "The workspace has been successfully deleted.",
      color: "success",
    });
    window.dispatchEvent(new CustomEvent("refresh-review-stats"));
  } catch (err) {
    toast.add({
      title: "Error",
      description: "An error occurred while deleting the workspace.",
    });
  } finally {
    showDeleteConfirm.value = false;
    workspaceToDelete.value = null;
  }
};

function editWorkspaceRow(workspace: Workspace) {
  editWorkspace.value = workspace;
  show.value = true;
}

function workspaceMenuItems(workspace: Workspace) {
  return [
    {
      label: "Open Workspace",
      icon: "i-lucide-arrow-up-right",
      to: `/workspaces/${workspace.id}`,
    },
    {
      label: "Edit Workspace",
      icon: "i-lucide-edit-3",
      onSelect: () => editWorkspaceRow(workspace),
    },
    {
      label: "Delete Workspace",
      icon: "i-lucide-trash-2",
      disabled: deletingWorkspace.value,
      onSelect: () => requestDeleteWorkspace(workspace.id),
    },
  ];
}

// A compact, honest "what's inside" line (Phase 1 AI-summary placeholder).
function workspaceSummary(workspace: Workspace) {
  const materials = workspace.materials?.length ?? 0;
  const cards = workspace.flashcards?.length ?? 0;
  const questions = workspace.questions?.length ?? 0;
  const parts: string[] = [];
  if (materials) parts.push(`${materials} material${materials > 1 ? "s" : ""}`);
  if (cards) parts.push(`${cards} card${cards > 1 ? "s" : ""}`);
  if (questions) parts.push(`${questions} question${questions > 1 ? "s" : ""}`);
  return parts.join(" · ") || "Empty workspace";
}

// Coverage gap = materials this workspace hasn't turned into cards yet.
function workspaceGap(workspace: Workspace) {
  return materialsWithoutCards(workspace).length;
}

function formatUpdatedAt(value: Workspace["updatedAt"]) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Updated recently";

  return `Updated ${date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  })}`;
}

async function handleWorkspaceImportSynced() {
  await refresh();
  window.dispatchEvent(new CustomEvent("refresh-review-stats"));
}

onMounted(() => {
  if (import.meta.dev) {
    console.log("[workspaces/index] forcing refresh() onMounted", {
      timestamp: Date.now(),
    });
    refresh();
  }
});
</script>

<template>
  <shared-page-wrapper>
    <div class="space-y-5">
      <section class="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div class="min-w-0">
          <p class="text-xs font-semibold uppercase tracking-widest text-content-secondary">
            Workspace hub
          </p>
          <div class="mt-1 flex flex-wrap items-end gap-3">
            <h1 class="text-2xl font-semibold tracking-normal text-content-on-surface">
              Workspaces
            </h1>
            <span class="pb-1 text-sm text-content-secondary">
              {{ workspaces?.length ?? 0 }} total<span v-if="totalDue > 0"> · {{ totalDue }} due today</span>
            </span>
          </div>
        </div>

        <div class="flex flex-wrap items-center gap-2">
          <UiButton size="sm" variant="soft" tone="neutral" leading-icon="i-lucide-languages" @click="openQuickCapture">
            Capture
          </UiButton>

          <UiPopover>
            <UiButton size="sm" variant="ghost" tone="neutral" leading-icon="i-lucide-settings-2">
              Settings
            </UiButton>
            <template #content>
              <div class="w-72 space-y-2 p-2">
                <div class="px-2 py-1">
                  <p class="text-sm font-semibold text-content-on-surface">
                    Quick settings
                  </p>
                  <p class="mt-0.5 text-xs text-content-secondary">
                    Jump to focused preferences without leaving your flow.
                  </p>
                </div>
                <NuxtLink v-for="link in quickSettingsLinks" :key="link.label" :to="link.to"
                  class="flex items-center gap-3 rounded-[var(--radius-md)] px-2 py-2 transition hover:bg-surface-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ds-focus-outline-color)]">
                  <span
                    class="flex h-8 w-8 shrink-0 items-center justify-center rounded-[var(--radius-md)] bg-primary/10 text-primary">
                    <Icon :name="link.icon" class="h-4 w-4" />
                  </span>
                  <span class="min-w-0">
                    <span class="block truncate text-sm font-medium text-content-on-surface">{{ link.label }}</span>
                    <span class="block truncate text-xs text-content-secondary">{{ link.description }}</span>
                  </span>
                </NuxtLink>
              </div>
            </template>
          </UiPopover>

          <UiButton size="sm" leading-icon="i-lucide-plus" @click="openCreateWorkspace">
            Create
          </UiButton>
        </div>
      </section>

      <UiPanel
        v-if="continueWorkspace"
        variant="subtle"
        size="md"
        class-name="bg-primary/5"
        content-class="flex flex-wrap items-center gap-4">
        <span class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-surface text-primary">
          <Icon name="i-lucide-play" class="h-5 w-5" aria-hidden="true" />
        </span>
        <div class="min-w-0 flex-1">
          <p class="text-sm font-semibold text-content-on-surface">
            Pick up where you left off
          </p>
          <p class="mt-0.5 text-sm text-content-secondary">
            {{ continueWorkspace.due }} card{{ continueWorkspace.due > 1 ? "s" : "" }} due in
            <span class="font-medium text-content-on-surface">{{ continueWorkspace.workspace.title }}</span>
          </p>
        </div>
        <UiButton size="sm" tone="primary" leading-icon="i-lucide-play"
          :to="`/user/review?workspaceId=${continueWorkspace.workspace.id}`">
          Review now
        </UiButton>
      </UiPanel>

      <section class="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_18rem]">
        <ReviewStatusCard minimal :show-context="false"
          empty-message="Enroll flashcards or materials to start reviewing" />
        <LanguageStatusCard minimal />
        <UiPanel variant="surface" size="sm">
          <div class="flex items-center gap-3">
            <span
              class="flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--radius-md)] bg-white ring-1 ring-secondary">
              <IntegrationAppsIcon class="h-5 w-5" />
            </span>
            <div class="min-w-0">
              <p class="truncate text-sm font-semibold text-content-on-surface">
                Apps
              </p>
              <p class="truncate text-xs text-content-secondary">
                Import Jira tasks or Notion pages from any row.
              </p>
            </div>
          </div>
        </UiPanel>
      </section>

      <shared-error-message v-if="error" :error="error" :refresh="refresh" />

      <UiPanel tag="section" variant="surface" size="xs" content-class="p-0">
        <div
          class="flex flex-col gap-3 border-b border-secondary p-3 md:flex-row md:items-center md:justify-between bg-surface-strong">
          <div class="min-w-0">
            <p class="text-sm font-semibold text-content-on-surface">
              Workspace list
            </p>
            <p class="mt-0.5 text-xs text-content-secondary">
              {{ visibleWorkspaceCount }} shown ·
              {{ workspaceTotals.materials }} materials ·
              {{ workspaceTotals.flashcards }} cards ·
              {{ workspaceTotals.questions }} questions
            </p>
          </div>
          <div class="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
            <div class="flex items-center gap-1" role="group" aria-label="Sort workspaces">
              <UiButton v-for="opt in sortOptions" :key="opt.value" size="xs"
                :variant="sortBy === opt.value ? 'soft' : 'ghost'" tone="neutral" :aria-pressed="sortBy === opt.value"
                @click="sortBy = opt.value">
                {{ opt.label }}
              </UiButton>
            </div>
            <UiInput v-model="searchQuery" type="search" placeholder="Search workspaces..." icon="i-lucide-search"
              aria-label="Search workspaces" />
          </div>
        </div>

        <div v-if="loading" class="divide-y divide-secondary">
          <div v-for="n in 4" :key="n" class="flex items-center gap-3 p-4">
            <UiSkeleton shape="rect" width="2.5rem" height="2.5rem"
              class="h-10 w-10 rounded-full bg-muted/50 dark:bg-muted/30" />
            <div class="min-w-0 flex-1 space-y-2">
              <UiSkeleton shape="text" width="12rem" class="h-4 w-48 bg-muted/50 dark:bg-muted/30" />
              <UiSkeleton shape="text" width="18rem" class="h-3 w-72 max-w-full bg-muted/50 dark:bg-muted/30" />
            </div>
            <UiSkeleton shape="rect" width="8rem" height="2rem"
              class="hidden h-8 w-32 bg-muted/50 dark:bg-muted/30 sm:block" />
          </div>
        </div>

        <div v-else-if="!hasWorkspaces" class="grid min-h-72 place-items-center p-6 text-center">
          <div class="max-w-md">
            <div
              class="mx-auto flex h-12 w-12 items-center justify-center rounded-[var(--radius-lg)] bg-primary/10 text-primary">
              <Icon name="i-lucide-folder-plus" class="h-6 w-6" />
            </div>
            <h2 class="mt-4 text-lg font-semibold text-content-on-surface">
              Create your first workspace
            </h2>
            <p class="mt-2 text-sm text-content-secondary">
              Start clean, import from Apps, or capture language as you study.
            </p>
            <div class="mt-5 flex flex-wrap justify-center gap-2">
              <UiButton size="sm" leading-icon="i-lucide-plus" @click="openCreateWorkspace">
                Create workspace
              </UiButton>
              <UiButton size="sm" variant="soft" tone="neutral" leading-icon="i-lucide-languages"
                @click="openQuickCapture">
                Capture word
              </UiButton>
            </div>
          </div>
        </div>

        <div v-else-if="filteredWorkspaces.length === 0" class="grid min-h-56 place-items-center p-6 text-center">
          <div>
            <Icon name="i-lucide-search-x" class="mx-auto h-8 w-8 text-content-disabled" />
            <p class="mt-3 text-sm font-medium text-content-on-surface">
              No matching workspaces
            </p>
            <p class="mt-1 text-xs text-content-secondary">
              Try a different search term.
            </p>
          </div>
        </div>

        <ul v-else class="divide-y divide-secondary">
          <li v-for="workspace in sortedWorkspaces" :key="workspace.id"
            class="group flex flex-col gap-3 p-3 transition hover:bg-surface-subtle/70 md:flex-row md:items-center">
            <NuxtLink :to="`/workspaces/${workspace.id}`"
              class="flex min-w-0 flex-1 items-start gap-3 rounded-[var(--radius-md)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ds-focus-outline-color)]">
              <span
                class="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                <Icon name="i-lucide-panels-top-left" class="h-5 w-5" />
              </span>
              <span class="min-w-0 flex-1">
                <span class="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span class="truncate text-sm font-semibold text-content-on-surface">
                    {{ workspace.title }}
                  </span>
                  <span v-if="dueCount(workspace) > 0"
                    class="inline-flex items-center rounded-full bg-error/10 px-2 py-0.5 text-xs font-medium text-error-text">
                    {{ dueCount(workspace) }} due
                  </span>
                  <span v-else-if="isStale(workspace)"
                    class="inline-flex items-center rounded-full bg-warning/15 px-2 py-0.5 text-xs font-medium text-warning-text">
                    going stale
                  </span>
                  <span class="text-xs text-content-secondary">
                    {{ formatUpdatedAt(workspace.updatedAt) }}
                  </span>
                </span>
                <span v-if="workspace.description" class="mt-1 block line-clamp-1 text-sm text-content-secondary">
                  {{ workspace.description }}
                </span>
                <span class="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-content-secondary">
                  <span>{{ workspaceSummary(workspace) }}</span>
                  <span v-if="workspaceGap(workspace) > 0" class="inline-flex items-center gap-1 text-warning-text">
                    <Icon name="i-lucide-sparkles" class="h-3 w-3" aria-hidden="true" />
                    {{ workspaceGap(workspace) }} material{{ workspaceGap(workspace) > 1 ? "s" : "" }} not yet cards
                  </span>
                </span>
                <span v-if="masteryFor(workspace.id) !== null" class="mt-2 flex items-center gap-2">
                  <span class="h-1.5 w-32 max-w-full overflow-hidden rounded-full bg-surface-strong">
                    <span class="block h-full rounded-full bg-success"
                      :style="{ width: masteryFor(workspace.id) + '%' }" />
                  </span>
                  <span class="text-xs text-content-secondary">{{ masteryFor(workspace.id) }}% mastered</span>
                </span>
              </span>
            </NuxtLink>

            <div class="flex flex-wrap items-center gap-2 md:justify-end">
              <UiButton v-if="rowAction(workspace) === 'review'" size="xs" tone="primary" leading-icon="i-lucide-play"
                :to="`/user/review?workspaceId=${workspace.id}`">
                Review {{ dueCount(workspace) }}
              </UiButton>
              <UiButton v-else-if="rowAction(workspace) === 'generate'" size="xs" variant="soft" tone="primary"
                leading-icon="i-lucide-sparkles" :loading="generatingId === workspace.id"
                :disabled="!!generatingId && generatingId !== workspace.id" @click="generateForWorkspace(workspace)">
                Generate
              </UiButton>
              <UiButton v-else-if="rowAction(workspace) === 'refresh'" size="xs" variant="soft" tone="warning"
                leading-icon="i-lucide-refresh-cw" :to="`/user/review?workspaceId=${workspace.id}`">
                Refresh
              </UiButton>
              <UiButton v-else size="xs" variant="ghost" tone="neutral" :to="`/workspaces/${workspace.id}`"
                trailing-icon="i-lucide-arrow-up-right">
                Open
              </UiButton>

              <WorkspaceImportDialog :workspace-id="workspace.id" trigger-label="Apps" trigger-size="xs"
                @imported="handleWorkspaceImportSynced" />

              <UiIconButton icon="i-lucide-pencil" label="Edit workspace" size="xs" variant="ghost"
                @click="editWorkspaceRow(workspace)" />

              <UiActionMenu :items="workspaceMenuItems(workspace)"
                :content="{ align: 'end', side: 'bottom', sideOffset: 4 }">
                <UiIconButton icon="i-lucide-more-horizontal" label="Workspace actions" size="xs" variant="ghost" />
              </UiActionMenu>
            </div>
          </li>
        </ul>
      </UiPanel>
    </div>

    <workspace-upsert-workspace-form :show="show" :workspace="editWorkspace" @cancel="cancelUpsertModal"
      @created="refresh()" />

    <shared-delete-confirmation-modal :show="showDeleteConfirm" title="Delete Workspace" :loading="deletingWorkspace"
      @close="showDeleteConfirm = false" @confirm="confirmDeleteWorkspace">
      Are you sure you want to delete this workspace? This action cannot be
      undone.
    </shared-delete-confirmation-modal>

    <QuickCaptureModal :show="isQuickCaptureOpen" @close="closeQuickCapture" />
  </shared-page-wrapper>
</template>

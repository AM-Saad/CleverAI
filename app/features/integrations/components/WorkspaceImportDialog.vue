<script setup lang="ts">
import type {
  ExternalSource,
  IntegrationProvider,
  IntegrationTarget,
  PreviewWorkspaceImportResponse,
  RunWorkspaceImportResponse,
  WorkspaceImportMappingSummary,
  WorkspaceIntegrationAccount,
} from "@@/shared/utils/workspaceIntegration.contract";
import IntegrationAppsIcon from "./IntegrationAppsIcon.vue";
import IntegrationProviderLogo from "./IntegrationProviderLogo.vue";

const props = withDefaults(defineProps<{
  workspaceId: string;
  defaultTarget?: IntegrationTarget;
  triggerLabel?: string;
  triggerSize?: "xs" | "sm" | "md";
  statusToColumnId?: Record<string, string | null>;
}>(), {
  defaultTarget: "BOARD_ITEM",
  triggerLabel: "Apps",
  triggerSize: "xs",
  statusToColumnId: () => ({}),
});

const emit = defineEmits<{
  imported: [RunWorkspaceImportResponse];
}>();

const { $api } = useNuxtApp();
const toast = useToast();

const isOpen = ref(false);
const accounts = ref<WorkspaceIntegrationAccount[]>([]);
const sources = ref<ExternalSource[]>([]);
const selectedAccountId = ref("");
const selectedSourceId = ref("");
const targetType = ref<IntegrationTarget>(props.defaultTarget);
const limit = ref(50);
const jql = ref("");
const noteGroupTitle = ref("");
const showAdvanced = ref(false);
const preview = ref<PreviewWorkspaceImportResponse | null>(null);
const result = ref<RunWorkspaceImportResponse | null>(null);
const mappings = ref<WorkspaceImportMappingSummary[]>([]);
const error = ref<string | null>(null);
const isLoadingAccounts = ref(false);
const isLoadingSources = ref(false);
const isLoadingMappings = ref(false);
const isPreviewing = ref(false);
const isImporting = ref(false);
const refreshingMappingId = ref<string | null>(null);

const selectedAccount = computed(() =>
  accounts.value.find((account) => account.id === selectedAccountId.value) ?? null,
);
const selectedSource = computed(() =>
  sources.value.find((source) => source.id === selectedSourceId.value) ?? null,
);
const canImportTasks = computed(() =>
  selectedSource.value?.supportedKinds.includes("TASK") ?? false,
);
const canImportDocuments = computed(() =>
  selectedSource.value?.supportedKinds.includes("DOCUMENT") ?? false,
);
const providerCards = computed(() => [
  {
    provider: "jira" as const,
    name: "Jira",
    description: "Projects and issues",
    connected: accounts.value.filter((account) => account.provider === "jira").length,
  },
  {
    provider: "notion" as const,
    name: "Notion",
    description: "Pages and data sources",
    connected: accounts.value.filter((account) => account.provider === "notion").length,
  },
]);
const accountOptions = computed(() =>
  accounts.value.map((account) => ({
    label: `${account.provider === "jira" ? "Jira" : "Notion"} · ${account.displayName}${account.accountUrl ? ` · ${account.accountUrl}` : ""}`,
    value: account.id,
  })),
);
const sourceOptions = computed(() =>
  sources.value.map((source) => ({
    label: source.key ? `${source.key} · ${source.name}` : source.name,
    value: source.id,
  })),
);
const selectedContentKinds = computed(() =>
  targetType.value === "NOTE" ? ["DOCUMENT" as const] : ["TASK" as const],
);
const previewCountLabel = computed(() => {
  if (!preview.value) return "No preview yet";
  const taskCount = preview.value.tasks.length;
  const docCount = preview.value.documents.length;
  if (targetType.value === "NOTE") return `${docCount} document${docCount === 1 ? "" : "s"} ready`;
  return `${taskCount} task${taskCount === 1 ? "" : "s"} ready`;
});

function openDialog() {
  isOpen.value = true;
}

function closeDialog() {
  isOpen.value = false;
}

function providerName(provider?: string | null) {
  if (provider === "jira") return "Jira";
  if (provider === "notion") return "Notion";
  return "Provider";
}

function resetPreview() {
  preview.value = null;
  result.value = null;
}

function applySourceDefaults(source: ExternalSource | null) {
  if (!source) return;
  const preferred = source.defaultTarget ?? props.defaultTarget;
  if (preferred === "BOARD_ITEM" && source.supportedKinds.includes("TASK")) {
    targetType.value = "BOARD_ITEM";
  } else if (source.supportedKinds.includes("DOCUMENT")) {
    targetType.value = "NOTE";
  } else {
    targetType.value = "BOARD_ITEM";
  }
  noteGroupTitle.value ||= `Imported from ${providerName(source.provider)}`;
}

async function loadAccounts() {
  isLoadingAccounts.value = true;
  error.value = null;
  try {
    const response = await $api.workspaceIntegrations.getAccounts();
    if (!response.success) {
      error.value = response.error?.message || "Could not load connected accounts";
      return;
    }
    accounts.value = response.data;
    selectedAccountId.value ||= response.data[0]?.id ?? "";
  } catch (err) {
    error.value = err instanceof Error ? err.message : "Could not load connected accounts";
  } finally {
    isLoadingAccounts.value = false;
  }
}

async function loadMappings() {
  isLoadingMappings.value = true;
  try {
    const response = await $api.workspaceIntegrations.getMappings(props.workspaceId);
    if (response.success) {
      mappings.value = response.data;
    }
  } finally {
    isLoadingMappings.value = false;
  }
}

async function loadSources(accountId: string) {
  if (!accountId) {
    sources.value = [];
    selectedSourceId.value = "";
    return;
  }

  isLoadingSources.value = true;
  error.value = null;
  resetPreview();
  try {
    const response = await $api.workspaceIntegrations.getSources(accountId);
    if (!response.success) {
      error.value = response.error?.message || "Could not load integration sources";
      return;
    }
    sources.value = response.data;
    selectedSourceId.value = response.data[0]?.id ?? "";
    applySourceDefaults(response.data[0] ?? null);
  } catch (err) {
    error.value = err instanceof Error ? err.message : "Could not load integration sources";
  } finally {
    isLoadingSources.value = false;
  }
}

function connect(provider: IntegrationProvider) {
  if (!import.meta.client) return;
  window.location.href = $api.workspaceIntegrations.getOAuthStartUrl(
    provider,
    props.workspaceId,
  );
}

function fieldMapping() {
  return {
    projectKey: selectedSource.value?.key ?? undefined,
    statusToColumnId: props.statusToColumnId,
    ...(jql.value.trim() ? { jql: jql.value.trim() } : {}),
  };
}

async function previewSelectedSource() {
  if (!selectedAccount.value || !selectedSource.value) return;
  isPreviewing.value = true;
  error.value = null;
  result.value = null;
  try {
    const response = await $api.workspaceIntegrations.previewImport({
      workspaceId: props.workspaceId,
      accountId: selectedAccount.value.id,
      sourceId: selectedSource.value.id,
      sourceKey: selectedSource.value.key,
      targetType: targetType.value,
      contentKinds: [...selectedContentKinds.value],
      limit: Math.min(limit.value, 10),
      fieldMapping: fieldMapping(),
      importOptions: {},
    });
    if (!response.success) {
      error.value = response.error?.message || "Preview failed";
      return;
    }
    preview.value = response.data;
  } catch (err) {
    error.value = err instanceof Error ? err.message : "Preview failed";
  } finally {
    isPreviewing.value = false;
  }
}

async function importSelectedSource() {
  if (!selectedAccount.value || !selectedSource.value) return;
  isImporting.value = true;
  error.value = null;
  try {
    const response = await $api.workspaceIntegrations.runImport({
      workspaceId: props.workspaceId,
      accountId: selectedAccount.value.id,
      sourceId: selectedSource.value.id,
      sourceKey: selectedSource.value.key,
      sourceName: selectedSource.value.name,
      targetType: targetType.value,
      contentKinds: [...selectedContentKinds.value],
      noteGroupTitle: noteGroupTitle.value || `Imported from ${providerName(selectedSource.value.provider)}`,
      limit: limit.value,
      fieldMapping: fieldMapping(),
      importOptions: {
        includeProviderTags: true,
      },
    });
    if (!response.success) {
      error.value = response.error?.message || "Import failed";
      return;
    }
    result.value = response.data;
    void loadMappings();
    toast.add({
      title: targetType.value === "NOTE" ? "Documents imported" : "Tasks imported",
      description: `${response.data.created} created, ${response.data.updated} updated, ${response.data.conflicted} conflicts`,
      color: response.data.conflicted > 0 ? "warning" : "success",
    });
    emit("imported", response.data);
  } catch (err) {
    error.value = err instanceof Error ? err.message : "Import failed";
  } finally {
    isImporting.value = false;
  }
}

async function refreshMapping(mapping: WorkspaceImportMappingSummary) {
  refreshingMappingId.value = mapping.id;
  error.value = null;
  try {
    const response = await $api.workspaceIntegrations.refreshImport({ mappingId: mapping.id });
    if (!response.success) {
      error.value = response.error?.message || "Refresh failed";
      return;
    }
    result.value = response.data;
    toast.add({
      title: "Import refreshed",
      description: `${response.data.updated} updated, ${response.data.conflicted} conflicts`,
      color: response.data.conflicted > 0 ? "warning" : "success",
    });
    emit("imported", response.data);
    await loadMappings();
  } catch (err) {
    error.value = err instanceof Error ? err.message : "Refresh failed";
  } finally {
    refreshingMappingId.value = null;
  }
}

watch(isOpen, (open) => {
  if (!open) return;
  if (accounts.value.length === 0) void loadAccounts();
  void loadMappings();
});

watch(selectedAccountId, (accountId) => {
  void loadSources(accountId);
});

watch(selectedSourceId, (sourceId) => {
  resetPreview();
  applySourceDefaults(sources.value.find((source) => source.id === sourceId) ?? null);
});

watch(targetType, resetPreview);
</script>

<template>
  <div>
    <UiButton
      :size="triggerSize"
      tone="neutral"
      variant="ghost"
      @click="openDialog"
    >
      <template #leading>
        <IntegrationAppsIcon class="h-4 w-4" />
      </template>
      <span class="toolbar-label">{{ triggerLabel }}</span>
    </UiButton>

    <Teleport to="body">
      <Transition
        enter-active-class="transition duration-150 ease-out"
        enter-from-class="opacity-0"
        enter-to-class="opacity-100"
        leave-active-class="transition duration-100 ease-in"
        leave-from-class="opacity-100"
        leave-to-class="opacity-0"
      >
        <div
          v-if="isOpen"
          class="fixed inset-0 z-9999 flex items-center justify-center bg-content-on-background/45 p-4"
          role="presentation"
          @click.self="closeDialog"
        >
          <section
            class="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-[var(--radius-xl)] border border-secondary bg-surface shadow-[var(--shadow-modal)]"
            role="dialog"
            aria-modal="true"
            aria-labelledby="workspace-apps-title"
          >
            <header class="flex items-start justify-between gap-4 border-b border-secondary bg-surface px-5 py-4">
              <div class="flex min-w-0 items-start gap-3">
                <span class="mt-0.5 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--radius-md)] bg-white ring-1 ring-secondary">
                  <IntegrationAppsIcon class="h-6 w-6" />
                </span>
                <div class="min-w-0">
                  <p class="text-xs font-semibold uppercase tracking-widest text-content-secondary">
                    Apps
                  </p>
                  <h2 id="workspace-apps-title" class="truncate text-lg font-semibold text-content-on-surface">
                    Connect apps and import content
                  </h2>
                </div>
              </div>
              <UiIconButton
                icon="i-heroicons-x-mark"
                label="Close apps"
                size="sm"
                variant="ghost"
                @click="closeDialog"
              />
            </header>

            <div class="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-5">
              <div class="grid gap-3 sm:grid-cols-2">
                <button
                  v-for="card in providerCards"
                  :key="card.provider"
                  type="button"
                  class="group flex min-h-24 items-center justify-between gap-3 rounded-[var(--radius-lg)] border border-secondary bg-white p-4 text-left transition hover:border-primary/60 hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                  @click="connect(card.provider)"
                >
                  <span class="flex min-w-0 items-center gap-3">
                    <span class="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--radius-md)] bg-surface-subtle text-primary ring-1 ring-secondary transition group-hover:bg-primary/10 group-hover:ring-primary/30">
                      <IntegrationProviderLogo :provider="card.provider" class="h-5 w-5" />
                    </span>
                    <span class="min-w-0">
                      <span class="block truncate text-sm font-semibold text-content-on-surface">{{ card.name }}</span>
                      <span class="mt-0.5 block truncate text-xs text-content-secondary">{{ card.description }}</span>
                      <UiBadge class="mt-2" tone="neutral" variant="soft" size="xs">
                        {{ card.connected > 0 ? `${card.connected} connected` : "Connect" }}
                      </UiBadge>
                    </span>
                  </span>
                  <Icon name="i-heroicons-arrow-top-right-on-square" class="h-4 w-4 shrink-0 text-content-secondary transition group-hover:text-primary" />
                </button>
              </div>

              <div class="space-y-4 rounded-[var(--radius-lg)] border border-secondary bg-surface-subtle p-4">
                <div class="flex items-center justify-between gap-3 border-b border-secondary pb-3">
                  <div class="min-w-0">
                    <p class="truncate text-sm font-semibold text-content-on-surface">Source and destination</p>
                    <p class="mt-0.5 text-xs text-content-secondary">
                      {{ accounts.length }} connected account{{ accounts.length === 1 ? "" : "s" }}
                    </p>
                  </div>
                  <UiIconButton
                    :icon="isLoadingAccounts ? 'svg-spinners:ring-resize' : 'i-heroicons-arrow-path'"
                    label="Refresh connected accounts"
                    size="sm"
                    variant="ghost"
                    :disabled="isLoadingAccounts"
                    @click="loadAccounts"
                  />
                </div>

                <div class="grid gap-3 md:grid-cols-2">
                  <label class="space-y-1.5">
                    <span class="text-xs font-semibold text-content-secondary">Connected account</span>
                    <select
                      v-model="selectedAccountId"
                      class="h-10 w-full rounded-[var(--radius-md)] border border-secondary bg-white px-3 text-sm text-content-on-surface outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/30"
                    >
                      <option value="">{{ isLoadingAccounts ? "Loading accounts..." : "Select an account" }}</option>
                      <option v-for="account in accountOptions" :key="account.value" :value="account.value">
                        {{ account.label }}
                      </option>
                    </select>
                  </label>

                  <label class="space-y-1.5">
                    <span class="text-xs font-semibold text-content-secondary">External source</span>
                    <select
                      v-model="selectedSourceId"
                      class="h-10 w-full rounded-[var(--radius-md)] border border-secondary bg-white px-3 text-sm text-content-on-surface outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/30 disabled:cursor-not-allowed disabled:bg-surface-strong disabled:text-content-secondary"
                      :disabled="isLoadingSources || sourceOptions.length === 0"
                    >
                      <option value="">
                        {{ isLoadingSources ? "Loading sources..." : "Select a source" }}
                      </option>
                      <option v-for="source in sourceOptions" :key="source.value" :value="source.value">
                        {{ source.label }}
                      </option>
                    </select>
                  </label>
                </div>

                <div class="grid gap-3 md:grid-cols-2">
                  <button
                    type="button"
                    class="flex items-center gap-3 rounded-[var(--radius-md)] border p-3 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                    :class="targetType === 'BOARD_ITEM' ? 'border-primary bg-primary/5' : 'border-secondary bg-white'"
                    :disabled="!canImportTasks"
                    @click="targetType = 'BOARD_ITEM'"
                  >
                    <Icon name="i-heroicons-queue-list" class="h-5 w-5 text-primary" />
                    <span class="min-w-0">
                      <span class="block text-sm font-semibold text-content-on-surface">Board tasks</span>
                      <span class="block text-xs text-content-secondary">Jira issues or task-like Notion rows</span>
                    </span>
                  </button>

                  <button
                    type="button"
                    class="flex items-center gap-3 rounded-[var(--radius-md)] border p-3 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                    :class="targetType === 'NOTE' ? 'border-primary bg-primary/5' : 'border-secondary bg-white'"
                    :disabled="!canImportDocuments"
                    @click="targetType = 'NOTE'"
                  >
                    <Icon name="i-heroicons-document-text" class="h-5 w-5 text-primary" />
                    <span class="min-w-0">
                      <span class="block text-sm font-semibold text-content-on-surface">Notes documents</span>
                      <span class="block text-xs text-content-secondary">Notion pages into a note group</span>
                    </span>
                  </button>
                </div>

                <button
                  type="button"
                  class="flex w-full items-center justify-between rounded-[var(--radius-md)] px-1 py-1 text-sm font-medium text-content-secondary hover:text-content-on-surface"
                  @click="showAdvanced = !showAdvanced"
                >
                  <span>Advanced configuration</span>
                  <Icon :name="showAdvanced ? 'i-heroicons-chevron-up' : 'i-heroicons-chevron-down'" class="h-4 w-4" />
                </button>

                <div v-if="showAdvanced" class="grid gap-3 md:grid-cols-2">
                  <label class="space-y-1.5">
                    <span class="text-xs font-semibold text-content-secondary">Limit</span>
                    <input
                      v-model.number="limit"
                      type="number"
                      min="1"
                      max="100"
                      class="h-10 w-full rounded-[var(--radius-md)] border border-secondary bg-white px-3 text-sm text-content-on-surface outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/30"
                    >
                  </label>

                  <label v-if="targetType === 'NOTE'" class="space-y-1.5">
                    <span class="text-xs font-semibold text-content-secondary">Notes group</span>
                    <input
                      v-model="noteGroupTitle"
                      type="text"
                      class="h-10 w-full rounded-[var(--radius-md)] border border-secondary bg-white px-3 text-sm text-content-on-surface outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/30"
                      placeholder="Imported from Notion"
                    >
                  </label>

                  <label v-if="selectedAccount?.provider === 'jira'" class="space-y-1.5 md:col-span-2">
                    <span class="text-xs font-semibold text-content-secondary">JQL override</span>
                    <input
                      v-model="jql"
                      type="text"
                      class="h-10 w-full rounded-[var(--radius-md)] border border-secondary bg-white px-3 text-sm text-content-on-surface outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/30"
                      placeholder="project = ABC ORDER BY updated DESC"
                    >
                  </label>
                </div>

                <div v-if="error" class="flex items-start gap-2 rounded-[var(--radius-md)] border border-error/20 bg-error/10 p-3 text-sm text-error">
                  <Icon name="i-heroicons-exclamation-circle" class="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{{ error }}</span>
                </div>
              </div>

              <div class="rounded-[var(--radius-lg)] border border-secondary bg-white p-4">
                <div class="flex items-center justify-between gap-3">
                  <div>
                    <p class="text-sm font-semibold text-content-on-surface">Saved imports</p>
                    <p class="mt-0.5 text-xs text-content-secondary">
                      {{ mappings.length }} mapping{{ mappings.length === 1 ? "" : "s" }} in this workspace
                    </p>
                  </div>
                  <UiIconButton
                    :icon="isLoadingMappings ? 'svg-spinners:ring-resize' : 'i-heroicons-arrow-path'"
                    label="Reload saved imports"
                    size="sm"
                    variant="ghost"
                    :disabled="isLoadingMappings"
                    @click="loadMappings"
                  />
                </div>

                <div v-if="mappings.length" class="mt-4 space-y-2">
                  <div
                    v-for="mapping in mappings"
                    :key="mapping.id"
                    class="flex flex-col gap-3 rounded-[var(--radius-md)] border border-secondary bg-surface-subtle p-3 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div class="flex min-w-0 items-start gap-3">
                      <span class="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-[var(--radius-md)] bg-white ring-1 ring-secondary">
                        <IntegrationProviderLogo :provider="mapping.provider" class="h-4 w-4" />
                      </span>
                      <div class="min-w-0">
                      <p class="truncate text-sm font-medium text-content-on-surface">
                        {{ mapping.name }}
                      </p>
                      <p class="mt-0.5 text-xs text-content-secondary">
                        {{ providerName(mapping.provider) }} · {{ mapping.targetType === "NOTE" ? "Notes" : "Board" }} · {{ mapping.refCounts.total }} imported
                      </p>
                      <div class="mt-2 flex flex-wrap gap-1.5">
                        <UiBadge v-if="mapping.refCounts.conflicted" tone="warning" size="xs">
                          {{ mapping.refCounts.conflicted }} conflicts
                        </UiBadge>
                        <UiBadge v-if="mapping.refCounts.localChanged" tone="neutral" size="xs">
                          {{ mapping.refCounts.localChanged }} local edits
                        </UiBadge>
                        <UiBadge v-if="mapping.refCounts.error" tone="error" size="xs">
                          {{ mapping.refCounts.error }} errors
                        </UiBadge>
                        <UiBadge v-if="!mapping.refCounts.conflicted && !mapping.refCounts.localChanged && !mapping.refCounts.error" tone="success" size="xs">
                          Synced
                        </UiBadge>
                      </div>
                      </div>
                    </div>
                    <UiButton
                      size="xs"
                      tone="neutral"
                      variant="outline"
                      :loading="refreshingMappingId === mapping.id"
                      :disabled="Boolean(refreshingMappingId)"
                      leading-icon="i-heroicons-arrow-path"
                      @click="refreshMapping(mapping)"
                    >
                      Refresh
                    </UiButton>
                  </div>
                </div>
              </div>

              <div class="rounded-[var(--radius-lg)] border border-secondary bg-white p-4">
                <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p class="text-sm font-semibold text-content-on-surface">Preview</p>
                    <p class="mt-0.5 text-xs text-content-secondary">{{ previewCountLabel }}</p>
                  </div>
                  <UiButton
                    size="sm"
                    tone="neutral"
                    variant="outline"
                    :loading="isPreviewing"
                    :disabled="!selectedSource || isPreviewing"
                    leading-icon="i-heroicons-eye"
                    @click="previewSelectedSource"
                  >
                    Preview
                  </UiButton>
                </div>

                <div v-if="preview" class="mt-4 space-y-3">
                  <div
                    v-for="item in targetType === 'NOTE' ? preview.documents : preview.tasks"
                    :key="item.externalId"
                    class="rounded-[var(--radius-md)] border border-secondary bg-surface-subtle p-3"
                  >
                    <p class="truncate text-sm font-medium text-content-on-surface">{{ item.title }}</p>
                    <p v-if="'status' in item && item.status" class="mt-1 text-xs text-content-secondary">{{ item.status }}</p>
                    <p v-if="'excerpt' in item && item.excerpt" class="mt-1 line-clamp-2 text-xs text-content-secondary">{{ item.excerpt }}</p>
                  </div>
                  <div v-if="preview.warnings.length" class="rounded-[var(--radius-md)] border border-warning/20 bg-warning/10 p-3 text-xs text-warning">
                    <p v-for="warning in preview.warnings" :key="warning">{{ warning }}</p>
                  </div>
                </div>
              </div>

              <div v-if="result" class="rounded-[var(--radius-lg)] border border-success/20 bg-success/10 p-4 text-sm text-success">
                {{ result.created }} created, {{ result.updated }} updated, {{ result.skipped }} skipped, {{ result.conflicted }} conflicts.
              </div>
            </div>

            <footer class="flex flex-col gap-3 border-t border-secondary bg-surface px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
              <p class="text-xs text-content-secondary">
                Imports are one-way. Local edits are protected during refresh.
              </p>
              <div class="flex items-center justify-end gap-2">
                <UiButton size="sm" tone="neutral" variant="outline" @click="closeDialog">
                  Close
                </UiButton>
                <UiButton
                  size="sm"
                  tone="primary"
                  variant="solid"
                  :loading="isImporting"
                  :disabled="!selectedSource || isImporting"
                  leading-icon="i-heroicons-arrow-down-tray"
                  @click="importSelectedSource"
                >
                  Import
                </UiButton>
              </div>
            </footer>
          </section>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

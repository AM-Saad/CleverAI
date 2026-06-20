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
const sourceCards = computed(() =>
  sources.value.map((source) => ({
    ...source,
    isSelected: source.id === selectedSourceId.value,
    kindLabel: source.supportedKinds.includes("TASK") && source.supportedKinds.includes("DOCUMENT")
      ? "Tasks + docs"
      : source.supportedKinds.includes("TASK")
        ? "Tasks"
        : "Docs",
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
const previewItems = computed(() =>
  preview.value
    ? targetType.value === "NOTE"
      ? preview.value.documents
      : preview.value.tasks
    : [],
);
const importActionLabel = computed(() => {
  if (isImporting.value) return targetType.value === "NOTE" ? "Importing docs" : "Importing tasks";
  return targetType.value === "NOTE" ? "Import docs" : "Import tasks";
});
const canPreview = computed(() => Boolean(selectedAccount.value && selectedSource.value) && !isPreviewing.value);
const canRunImport = computed(() => Boolean(selectedAccount.value && selectedSource.value) && !isImporting.value);
const resultStats = computed(() => {
  if (!result.value) return [];
  return [
    { label: "Created", value: result.value.created, tone: "success" as const },
    { label: "Updated", value: result.value.updated, tone: "info" as const },
    { label: "Skipped", value: result.value.skipped, tone: "neutral" as const },
    { label: "Conflicts", value: result.value.conflicted, tone: result.value.conflicted ? "warning" as const : "neutral" as const },
  ];
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

function selectSource(source: ExternalSource) {
  selectedSourceId.value = source.id;
}

function updateLimit(value: string | number | null | undefined) {
  const nextValue = Number(value);
  limit.value = Number.isFinite(nextValue) ? nextValue : 50;
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
          <UiOverlaySurface
            tag="section"
            kind="modal"
            layer="modal"
            size="xs"
            class-name="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden p-0"
            role="dialog"
            aria-modal="true"
            aria-labelledby="workspace-apps-title"
          >
            <header class="flex items-start justify-between gap-4 border-b border-secondary bg-surface px-5 py-4">
              <div class="flex min-w-0 items-start gap-3">
                <span class="mt-0.5 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--radius-md)] bg-surface ring-1 ring-secondary">
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
                <UiInteractiveCard
                  v-for="card in providerCards"
                  :key="card.provider"
                  variant="outline"
                  size="sm"
                  class-name="group min-h-24"
                  content-class="flex min-w-0 items-center justify-between gap-3"
                  @click="connect(card.provider)"
                >
                  <span class="flex min-w-0 items-center gap-3">
                    <span class="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-[var(--radius-md)] bg-surface text-primary ring-1 ring-secondary transition group-hover:bg-primary/10 group-hover:ring-primary/30">
                      <IntegrationProviderLogo :provider="card.provider" class="h-7 w-7" />
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
                </UiInteractiveCard>
              </div>

              <UiPanel variant="subtle" size="md" content-class="space-y-4">
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
                    <UiSelect
                      v-model="selectedAccountId"
                      :items="accountOptions"
                      value-key="value"
                      label-key="label"
                      size="sm"
                      :placeholder="isLoadingAccounts ? 'Loading accounts...' : 'Select an account'"
                    />
                  </label>

                  <label class="space-y-1.5">
                    <span class="text-xs font-semibold text-content-secondary">External source</span>
                    <UiSelect
                      v-model="selectedSourceId"
                      :items="sourceOptions"
                      value-key="value"
                      label-key="label"
                      size="sm"
                      :placeholder="isLoadingSources ? 'Loading sources...' : 'Select a source'"
                      :disabled="isLoadingSources || sourceOptions.length === 0"
                    />
                  </label>
                </div>

                <div v-if="sourceCards.length" class="grid gap-2 md:grid-cols-2">
                  <UiInteractiveCard
                    v-for="source in sourceCards"
                    :key="source.id"
                    :selected="source.isSelected"
                    selectable
                    variant="outline"
                    size="xs"
                    content-class="flex min-w-0 items-center gap-3"
                    @click="selectSource(source)"
                  >
                    <span class="flex min-w-0 items-center gap-3">
                      <span class="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-[var(--radius-md)] bg-surface-subtle ring-1 ring-secondary">
                        <IntegrationProviderLogo :provider="source.provider" class="h-5 w-5" />
                      </span>
                      <span class="min-w-0">
                        <span class="block truncate text-sm font-semibold text-content-on-surface">{{ source.name }}</span>
                        <span class="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-content-secondary">
                          <span v-if="source.key">{{ source.key }}</span>
                          <UiBadge tone="neutral" variant="soft" size="xs">{{ source.kindLabel }}</UiBadge>
                        </span>
                      </span>
                    </span>
                  </UiInteractiveCard>
                </div>
                <UiPanel v-else-if="selectedAccountId && !isLoadingSources" variant="subtle" class-name="p-3">
                  <p class="text-sm font-medium text-content-on-surface">No sources found</p>
                  <p class="mt-1 text-xs text-content-secondary">Reconnect with workspace/page access, then refresh accounts.</p>
                </UiPanel>

                <div class="grid gap-3 md:grid-cols-2">
                  <UiInteractiveCard
                    type="button"
                    :selected="targetType === 'BOARD_ITEM'"
                    selectable
                    variant="outline"
                    size="xs"
                    content-class="flex min-w-0 items-center gap-3"
                    :disabled="!canImportTasks"
                    @click="targetType = 'BOARD_ITEM'"
                  >
                    <Icon name="i-heroicons-queue-list" class="h-5 w-5 text-primary" />
                    <span class="min-w-0">
                      <span class="block text-sm font-semibold text-content-on-surface">Board tasks</span>
                      <span class="block text-xs text-content-secondary">Jira issues or task-like Notion rows</span>
                    </span>
                  </UiInteractiveCard>

                  <UiInteractiveCard
                    type="button"
                    :selected="targetType === 'NOTE'"
                    selectable
                    variant="outline"
                    size="xs"
                    content-class="flex min-w-0 items-center gap-3"
                    :disabled="!canImportDocuments"
                    @click="targetType = 'NOTE'"
                  >
                    <Icon name="i-heroicons-document-text" class="h-5 w-5 text-primary" />
                    <span class="min-w-0">
                      <span class="block text-sm font-semibold text-content-on-surface">Notes documents</span>
                      <span class="block text-xs text-content-secondary">Notion pages into a note group</span>
                    </span>
                  </UiInteractiveCard>
                </div>

                <UiButton
                  type="button"
                  tone="neutral"
                  variant="link"
                  size="sm"
                  class="w-full justify-between px-1"
                  @click="showAdvanced = !showAdvanced"
                >
                  <span>Advanced configuration</span>
                  <Icon :name="showAdvanced ? 'i-heroicons-chevron-up' : 'i-heroicons-chevron-down'" class="h-4 w-4" />
                </UiButton>

                <div v-if="showAdvanced" class="grid gap-3 md:grid-cols-2">
                  <label class="space-y-1.5">
                    <span class="text-xs font-semibold text-content-secondary">Limit</span>
                    <UiInput
                      :model-value="limit"
                      type="number"
                      size="sm"
                      min="1"
                      max="100"
                      @update:model-value="updateLimit"
                    />
                  </label>

                  <label v-if="targetType === 'NOTE'" class="space-y-1.5">
                    <span class="text-xs font-semibold text-content-secondary">Notes group</span>
                    <UiInput
                      v-model="noteGroupTitle"
                      type="text"
                      size="sm"
                      placeholder="Imported from Notion"
                    />
                  </label>

                  <label v-if="selectedAccount?.provider === 'jira'" class="space-y-1.5 md:col-span-2">
                    <span class="text-xs font-semibold text-content-secondary">JQL override</span>
                    <UiInput
                      v-model="jql"
                      type="text"
                      size="sm"
                      placeholder="project = ABC ORDER BY updated DESC"
                    />
                  </label>
                </div>

                <UiPanel v-if="error" variant="subtle" size="sm" class-name="border-error/20 bg-error/10" content-class="flex items-start gap-2 text-error-text">
                  <Icon name="i-heroicons-exclamation-circle" class="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{{ error }}</span>
                </UiPanel>
              </UiPanel>

              <UiPanel variant="surface" size="md">
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
                  <UiPanel
                    v-for="mapping in mappings"
                    :key="mapping.id"
                    variant="subtle"
                    size="sm"
                    content-class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div class="flex min-w-0 items-start gap-3">
                      <span class="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-[var(--radius-md)] bg-surface ring-1 ring-secondary">
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
                  </UiPanel>
                </div>
              </UiPanel>

              <UiPanel variant="surface" size="md">
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
                    :disabled="!canPreview"
                    leading-icon="i-heroicons-eye"
                    @click="previewSelectedSource"
                  >
                    Preview
                  </UiButton>
                </div>

                <div v-if="isPreviewing" class="mt-4 grid gap-2">
                  <UiSkeleton v-for="index in 3" :key="index" class="h-14 rounded-[var(--radius-md)]" />
                </div>

                <div v-else-if="preview" class="mt-4 space-y-3">
                  <UiPanel
                    v-for="item in previewItems"
                    :key="item.externalId"
                    variant="subtle"
                    size="sm"
                  >
                    <p class="truncate text-sm font-medium text-content-on-surface">{{ item.title }}</p>
                    <p v-if="'status' in item && item.status" class="mt-1 text-xs text-content-secondary">{{ item.status }}</p>
                    <p v-if="'excerpt' in item && item.excerpt" class="mt-1 line-clamp-2 text-xs text-content-secondary">{{ item.excerpt }}</p>
                  </UiPanel>
                  <UiPanel v-if="preview.warnings.length" variant="subtle" size="sm" class-name="border-warning/20 bg-warning/10" content-class="text-xs text-warning-text">
                    <p v-for="warning in preview.warnings" :key="warning">{{ warning }}</p>
                  </UiPanel>
                </div>
                <UiPanel v-else variant="subtle" class-name="mt-4 p-3">
                  <p class="text-sm font-medium text-content-on-surface">Preview before import</p>
                  <p class="mt-1 text-xs text-content-secondary">Check sample rows, permissions, and warnings before writing to Board or Notes.</p>
                </UiPanel>
              </UiPanel>

              <UiPanel v-if="result" variant="subtle" size="md" class-name="border-success/20 bg-success/10">
                <p class="text-sm font-semibold text-success-text">Import complete</p>
                <div class="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                  <UiPanel
                    v-for="stat in resultStats"
                    :key="stat.label"
                    variant="surface"
                    size="xs"
                  >
                    <p class="text-lg font-semibold text-content-on-surface">{{ stat.value }}</p>
                    <UiBadge :tone="stat.tone" size="xs" variant="soft">{{ stat.label }}</UiBadge>
                  </UiPanel>
                </div>
              </UiPanel>
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
                  :disabled="!canRunImport"
                  leading-icon="i-heroicons-arrow-down-tray"
                  @click="importSelectedSource"
                >
                  {{ importActionLabel }}
                </UiButton>
              </div>
            </footer>
          </UiOverlaySurface>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

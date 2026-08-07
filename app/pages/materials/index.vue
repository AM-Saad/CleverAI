<template>
  <div class="mats">
    <AppPageHeader title="Materials" subtitle="Sources for your learning workspace" back-to="/learn">
      <template #actions>
        <UiButton size="sm" tone="primary" leading-icon="upload" :loading="uploading" :disabled="!canUpload"
          @click="pick">
          {{ isOffline ? "Save file" : "Upload" }}
        </UiButton>
      </template>
    </AppPageHeader>
    <WorkspacePill class="mats__wspill" />
    <UiFileInput ref="fileInput" accept=".pdf,.docx,.txt" @select="onFile" />

    <UiAlert v-if="isOffline && activeId" tone="info" icon="cloud-off" title="Offline materials"
      description="Showing saved materials. New files stay on this device until you upload them after reconnecting." />

    <div v-if="uploading" class="mats__uploading">
      <div class="mats__upload-head">
        <UiLabel size="sm" weight="bold" color="content-on-surface">
          {{ uploadingName }}
        </UiLabel>
        <UiParagraph size="xs" color="content-secondary">
          {{ uploadProgress < 100 ? `${uploadProgress}%` : "Extracting text…" }} </UiParagraph>
      </div>
      <div class="mats__progress" role="progressbar" aria-label="Material upload progress" aria-valuemin="0"
        aria-valuemax="100" :aria-valuenow="uploadProgress">
        <span :style="{ width: `${uploadProgress}%` }" />
      </div>
    </div>

    <section v-if="uploadDrafts.length" class="mats__drafts">
      <div class="mats__section-head">
        <div>
          <UiTitle tag="h2" size="base" weight="bold" tight>
            Saved file drafts
          </UiTitle>
          <UiParagraph size="xs" color="content-secondary">
            {{ isOffline ? "Safe on this device" : "Ready to upload" }}
          </UiParagraph>
        </div>
        <UiBadge tone="neutral" variant="soft">
          {{ uploadDrafts.length }}
        </UiBadge>
      </div>
      <ul class="mats__list">
        <li v-for="draft in uploadDrafts" :key="draft.id">
          <UiListCard :title="draft.name"
            :description="`${formatBytes(draft.size)} · saved ${formatDraftDate(draft.createdAt)}`">
            <template #leading>
              <UiIcon name="file" class="h-4 w-4" aria-hidden="true" />
            </template>
            <template #action>
              <div class="mats__draft-actions">
                <UiButton v-if="!isOffline" size="xs" tone="primary" variant="soft" :disabled="uploading"
                  @click="uploadDraft(draft)">
                  Upload
                </UiButton>
                <UiIconButton icon="trash-2" label="Remove saved file draft" size="xs" tone="neutral" variant="ghost"
                  :disabled="uploading" @click="askRemoveDraft(draft)" />
              </div>
            </template>
          </UiListCard>
        </li>
      </ul>
    </section>

    <div v-if="(workspaceLoading || loading) && !materials.length" class="mats__list">
      <UiSkeleton v-for="i in 3" :key="i" class="h-16 w-full rounded-[var(--radius-lg)]" />
    </div>
    <UiEmptyState v-else-if="workspaceError" icon="triangle-alert" title="Couldn't load your workspaces"
      :description="workspaceErrorMessage" action-label="Try again" @action="refreshWorkspaceState" />
    <UiEmptyState v-else-if="!activeId" icon="layers" title="Create a workspace first"
      description="Materials need a workspace so generated study content stays organized."
      action-label="Create workspace" action-icon="plus" @action="navigateTo('/workspaces?new=1')" />
    <UiEmptyState v-else-if="loadError" icon="triangle-alert" title="Couldn't load materials" :description="loadError"
      action-label="Try again" @action="load" />
    <UiEmptyState v-else-if="!materials.length && !uploading" icon="file-stack"
      :title="isOffline ? 'No saved materials offline' : 'No materials yet'" :description="isOffline
        ? 'Download this workspace while online to make its materials available here.'
        : 'Upload a PDF, DOCX, or TXT file (up to 50 MB) to generate study content.'
        " :action-label="isOffline ? 'Save a file draft' : 'Upload material'" action-icon="upload" @action="pick" />
    <ul v-else class="mats__list">
      <li v-for="m in materials" :key="m.id" class="mats__row">
        <UiListCard clickable :description="`${typeLabel(m)} · ${metaFor(m)}`" @click="open(m.id)">
          <template #title>
            <span dir="auto">{{ m.title || "Untitled material" }}</span>
          </template>
          <template #leading>
            <UiLabel size="sm" weight="bold" color="content-secondary" aria-hidden="true">{{ typeLabel(m) }}</UiLabel>
          </template>
          <template #action>
            <UiActionMenu :items="materialMenuItems(m)" :label="`Actions for ${m.title || 'untitled material'}`" />
          </template>

        </UiListCard>
      </li>
    </ul>

    <UiModal v-model:open="renameOpen" title="Rename material" description="Use a clear name you can recognize later."
      icon="pencil" @close="clearRename">
      <UiFormField label="Material name" :error="renameError ?? undefined" required>
        <UiInput v-model="renameTitle" autofocus maxlength="240" :error="Boolean(renameError)"
          @keydown.enter="saveRename" />
      </UiFormField>
      <template #footer>
        <div class="mats__modal-actions">
          <UiButton tone="neutral" variant="ghost" @click="clearRename">
            Cancel
          </UiButton>
          <UiButton tone="primary" :loading="savingName" :disabled="!renameTitle.trim()" @click="saveRename">
            Save name
          </UiButton>
        </div>
      </template>
    </UiModal>

    <UiModal v-model:open="deleteOpen" title="Delete this material?" :description="deleteDescription" icon="trash-2"
      @close="clearDelete">
      <UiAlert tone="warning" icon="triangle-alert" title="Study data will be removed"
        description="Generated flashcards, quiz questions, and their review progress are deleted with this material." />
      <template #footer>
        <div class="mats__modal-actions">
          <UiButton tone="neutral" variant="ghost" @click="clearDelete">
            Cancel
          </UiButton>
          <UiButton tone="error" :loading="deleting" @click="deleteMaterial">
            {{ isOffline ? "Delete when online" : "Delete material" }}
          </UiButton>
        </div>
      </template>
    </UiModal>

    <UiModal v-model:open="removeDraftOpen" title="Remove saved file?" :description="draftToRemove
      ? `${draftToRemove.name} will be removed from this device.`
      : undefined
      " icon="trash-2" @close="clearDraftRemoval">
      <UiParagraph size="sm" color="content-secondary">
        This local file has not been uploaded. Removing it cannot be undone
        inside Clever.
      </UiParagraph>
      <template #footer>
        <div class="mats__modal-actions">
          <UiButton tone="neutral" variant="ghost" @click="clearDraftRemoval">
            Keep file
          </UiButton>
          <UiButton tone="error" @click="removeDraft">Remove file</UiButton>
        </div>
      </template>
    </UiModal>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import AppPageHeader from "~/components/patterns/AppPageHeader.vue";
import WorkspacePill from "~/components/shell/WorkspacePill.vue";
import { useActiveWorkspace } from "~/composables/workspaces/useActiveWorkspace";
import { useOfflineRuntime } from "~/composables/offline/useOfflineRuntime";
import {
  deleteOfflineUploadDraft,
  listOfflineEntities,
  listOfflineUploadDrafts,
  putOfflineEntities,
  replaceOfflineEntityCollection,
  saveOfflineBlob,
  type OfflineBlobRecord,
} from "~/utils/offline-v2/repository";
import type { Material } from "~/shared/utils/material.contract";

const { $api } = useNuxtApp();
const route = useRoute();
const toast = useToast();
const offline = useOfflineRuntime();
const {
  activeId,
  loading: workspaceLoading,
  error: workspaceError,
  refresh: refreshWorkspaces,
} = useActiveWorkspace();

const materials = ref<Material[]>([]);
const loading = ref(true);
const loadError = ref<string | null>(null);
const uploading = ref(false);
const uploadingName = ref("");
const uploadProgress = ref(0);
const uploadDrafts = ref<OfflineBlobRecord[]>([]);
const fileInput = ref<{ pick: () => void } | null>(null);
const lastUploadToken = ref("");
const renameOpen = ref(false);
const renameTarget = ref<Material | null>(null);
const renameTitle = ref("");
const renameError = ref<string | null>(null);
const savingName = ref(false);
const deleteOpen = ref(false);
const deleteTarget = ref<Material | null>(null);
const deleting = ref(false);
const removeDraftOpen = ref(false);
const draftToRemove = ref<OfflineBlobRecord | null>(null);
let loadSequence = 0;

const isOffline = computed(() => !offline.isOnline.value);
const canUpload = computed(
  () =>
    Boolean(activeId.value) &&
    !workspaceLoading.value &&
    !workspaceError.value &&
    !uploading.value,
);
const workspaceErrorMessage = computed(
  () =>
    workspaceError.value?.message ??
    "Check your connection and try loading your workspaces again.",
);
const deleteDescription = computed(() => {
  if (!deleteTarget.value) return "";
  const name = deleteTarget.value.title || "Untitled material";
  return isOffline.value
    ? `"${name}" will disappear now and be deleted everywhere after you reconnect.`
    : `"${name}" will be permanently deleted.`;
});

function pick() {
  if (!canUpload.value) return;
  fileInput.value?.pick();
}

async function onFile(files: FileList) {
  const file = files[0];
  const workspaceId = activeId.value;
  if (!file || !workspaceId) return;

  if (!validateFile(file)) return;

  if (isOffline.value) {
    await saveFileDraft(file, workspaceId);
    return;
  }

  await uploadMaterial(file, workspaceId);
}

function validateFile(file: File) {
  const extension = file.name.slice(file.name.lastIndexOf(".")).toLowerCase();
  if (![".pdf", ".docx", ".txt"].includes(extension)) {
    toast.add({
      title: "Unsupported file type",
      description: "Choose a PDF, DOCX, or TXT file.",
      color: "error",
    });
    return false;
  }
  if (file.size > 50 * 1024 * 1024) {
    toast.add({
      title: "File is too large",
      description: "Materials can be up to 50 MB.",
      color: "error",
    });
    return false;
  }
  return true;
}

async function saveFileDraft(file: File, workspaceId: string) {
  if (!offline.accountId.value) {
    toast.add({
      title: "Can't save this file offline yet",
      description: "Reconnect and sign in once, then try again.",
      color: "error",
    });
    return;
  }
  try {
    await saveOfflineBlob({
      accountId: offline.accountId.value,
      workspaceId,
      name: file.name,
      type: file.type,
      blob: file,
    });
    await loadUploadDrafts();
    toast.add({
      title: "File saved on this device",
      description: "It is ready for manual upload after you reconnect.",
      color: "warning",
    });
  } catch {
    toast.add({
      title: "Couldn't save the file locally",
      description: "Check available device storage and try again.",
      color: "error",
    });
  }
}

async function uploadMaterial(
  file: File,
  workspaceId: string,
  localDraftId?: string,
) {
  uploading.value = true;
  uploadingName.value = file.name;
  uploadProgress.value = 0;
  try {
    const response = await $api.materials.uploadFile(
      file,
      workspaceId,
      file.name,
      (progress) => {
        uploadProgress.value = progress;
      },
    );
    if (!response.success) {
      toast.add({
        title: "Upload failed",
        description: response.error.message,
        color: "error",
      });
      return;
    }

    if (localDraftId && offline.accountId.value) {
      await deleteOfflineUploadDraft(offline.accountId.value, localDraftId);
      await loadUploadDrafts();
    }

    if (response.data.truncated) {
      toast.add({
        title: "File uploaded with a text limit",
        description: `${response.data.charCount.toLocaleString()} of ${response.data.originalCharCount.toLocaleString()} characters were imported.`,
        color: "warning",
      });
    } else {
      toast.add({
        title: "Material ready",
        description: `"${response.data.title}" was uploaded and extracted.`,
        color: "success",
      });
    }
    await navigateTo(`/materials/${response.data.materialId}`);
  } catch (error) {
    toast.add({
      title: "Upload failed",
      description:
        error instanceof Error
          ? error.message
          : "Check your connection and try again.",
      color: "error",
    });
  } finally {
    uploading.value = false;
    uploadingName.value = "";
    uploadProgress.value = 0;
  }
}

async function uploadDraft(draft: OfflineBlobRecord) {
  const workspaceId = draft.workspaceId ?? activeId.value;
  if (!workspaceId || uploading.value) return;
  const file = new File([draft.blob], draft.name, {
    type: draft.type || "application/octet-stream",
    lastModified: draft.createdAt,
  });
  await uploadMaterial(file, workspaceId, draft.id);
}

async function loadUploadDrafts() {
  const accountId = offline.accountId.value;
  const workspaceId = activeId.value;
  if (!accountId || !workspaceId) {
    uploadDrafts.value = [];
    return;
  }
  try {
    const drafts = await listOfflineUploadDrafts(accountId, workspaceId);
    if (
      offline.accountId.value === accountId &&
      activeId.value === workspaceId
    ) {
      uploadDrafts.value = drafts;
    }
  } catch (error) {
    if (
      offline.accountId.value === accountId &&
      activeId.value === workspaceId
    ) {
      uploadDrafts.value = [];
    }
    console.warn("Couldn't load saved material file drafts", error);
  }
}

function askRemoveDraft(draft: OfflineBlobRecord) {
  draftToRemove.value = draft;
  removeDraftOpen.value = true;
}

function clearDraftRemoval() {
  removeDraftOpen.value = false;
  draftToRemove.value = null;
}

async function removeDraft() {
  const accountId = offline.accountId.value;
  const draft = draftToRemove.value;
  if (!accountId || !draft) return;
  try {
    await deleteOfflineUploadDraft(accountId, draft.id);
    clearDraftRemoval();
    await loadUploadDrafts();
    toast.add({ title: "Saved file removed", color: "success" });
  } catch {
    toast.add({
      title: "Couldn't remove saved file",
      description: "Check device storage access and try again.",
      color: "error",
    });
  }
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDraftDate(createdAt: number) {
  return new Date(createdAt).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

function open(id: string) {
  navigateTo(`/materials/${id}`);
}

function materialMenuItems(item: Material) {
  return [
    [
      {
        id: `rename-${item.id}`,
        label: "Rename",
        icon: "pencil",
        onSelect: () => askRename(item),
      },
    ],
    [
      {
        id: `delete-${item.id}`,
        label: "Delete",
        icon: "trash-2",
        color: "error",
        onSelect: () => askDelete(item),
      },
    ],
  ];
}

function askRename(item: Material) {
  renameTarget.value = item;
  renameTitle.value = item.title ?? "";
  renameError.value = null;
  renameOpen.value = true;
}

function clearRename() {
  renameOpen.value = false;
  renameTarget.value = null;
  renameTitle.value = "";
  renameError.value = null;
}

async function saveRename() {
  const target = renameTarget.value;
  const title = renameTitle.value.trim();
  if (!target || savingName.value) return;
  if (!title) {
    renameError.value = "Enter a material name.";
    return;
  }
  if (title === target.title) {
    clearRename();
    return;
  }

  savingName.value = true;
  renameError.value = null;
  try {
    let updated: Material;
    if (isOffline.value) {
      const next = { ...target, title, updatedAt: new Date().toISOString() };
      await offline.queue({
        entity: "material",
        operation: "material.update",
        entityId: target.id,
        workspaceId: target.workspaceId,
        changedFields: ["title"],
        payload: { title },
        localData: next as unknown as Record<string, unknown>,
      });
      updated = next;
    } else {
      const response = await $api.materials.update(target.id, { title });
      if (!response.success) {
        renameError.value = response.error.message;
        return;
      }
      updated = response.data;
      await cacheMaterialSnapshot(updated);
    }

    materials.value = materials.value.map((item) =>
      item.id === updated.id ? updated : item,
    );
    clearRename();
    toast.add({
      title: "Material renamed",
      description: isOffline.value
        ? "Change will sync after you reconnect."
        : undefined,
      color: "success",
    });
  } catch (error) {
    renameError.value =
      error instanceof Error ? error.message : "Couldn't rename material.";
  } finally {
    savingName.value = false;
  }
}

function askDelete(item: Material) {
  deleteTarget.value = item;
  deleteOpen.value = true;
}

function clearDelete() {
  if (deleting.value) return;
  deleteOpen.value = false;
  deleteTarget.value = null;
}

async function deleteMaterial() {
  const target = deleteTarget.value;
  if (!target || deleting.value) return;
  deleting.value = true;
  try {
    if (isOffline.value) {
      await offline.queue({
        entity: "material",
        operation: "material.delete",
        entityId: target.id,
        workspaceId: target.workspaceId,
        changedFields: ["deleted"],
        payload: {},
      });
      materials.value = materials.value.filter((item) => item.id !== target.id);
      toast.add({
        title: "Material removed",
        description: "Deletion will sync after you reconnect.",
        color: "warning",
      });
    } else {
      const response = await $api.materials.delete(target.id);
      if (!response.success) {
        toast.add({
          title: "Couldn't delete material",
          description: response.error.message,
          color: "error",
        });
        return;
      }
      materials.value = materials.value.filter((item) => item.id !== target.id);
      await load();
      toast.add({ title: "Material deleted", color: "success" });
    }
    deleteOpen.value = false;
    deleteTarget.value = null;
  } catch (error) {
    toast.add({
      title: "Couldn't delete material",
      description: error instanceof Error ? error.message : "Please try again.",
      color: "error",
    });
  } finally {
    deleting.value = false;
  }
}

function typeLabel(m: Material) {
  const t = (m.type ?? "").toLowerCase();
  if (t.includes("pdf")) return "PDF";
  if (t.includes("docx") || t.includes("document")) return "DOCX";
  if (t.includes("txt") || t.includes("text")) return "TXT";
  return "DOC";
}

async function cacheMaterialSnapshot(item: Material) {
  if (!offline.accountId.value) return;
  try {
    await putOfflineEntities([
      {
        id: `${offline.accountId.value}:material:${item.id}`,
        accountId: offline.accountId.value,
        entity: "material",
        entityId: item.id,
        workspaceId: item.workspaceId,
        version: 0,
        updatedAt: Date.now(),
        data: item as unknown as Record<string, unknown>,
      },
    ]);
  } catch (error) {
    console.warn("Couldn't refresh offline material snapshot", error);
  }
}
function metaFor(m: Material) {
  const meta = m.metadata as Record<string, unknown> | undefined;
  const pages =
    typeof meta?.pageCount === "number" ? `${meta.pageCount} pages · ` : "";
  const limited = meta?.truncated === true ? "limited import · " : "";
  return `${pages}${limited}${new Date(m.createdAt as string).toLocaleDateString(undefined, { month: "short", day: "numeric" })}`;
}

async function load() {
  const workspaceId = activeId.value;
  const sequence = ++loadSequence;
  if (!workspaceId) {
    materials.value = [];
    uploadDrafts.value = [];
    loadError.value = null;
    loading.value = false;
    return;
  }

  loading.value = true;
  loadError.value = null;
  await loadUploadDrafts();
  try {
    if (isOffline.value) {
      if (!offline.accountId.value) {
        loadError.value =
          "Sign in while online once before using saved materials offline.";
        materials.value = [];
        return;
      }
      const cached = await listOfflineEntities<Material>(
        offline.accountId.value,
        "material",
        workspaceId,
      );
      if (sequence === loadSequence) {
        materials.value = cached.map((record) => record.data);
      }
      return;
    }

    const response = await $api.materials.getByWorkspace(workspaceId);
    if (sequence !== loadSequence) return;
    if (!response.success) {
      materials.value = [];
      loadError.value = response.error.message;
      return;
    }

    materials.value = response.data;
    if (offline.accountId.value) {
      const accountId = offline.accountId.value;
      try {
        await replaceOfflineEntityCollection({
          accountId,
          entity: "material",
          workspaceId,
          foreignKey: "workspaceId",
          foreignId: workspaceId,
          records: response.data.map((item) => ({
            id: `${accountId}:material:${item.id}`,
            accountId,
            entity: "material" as const,
            entityId: item.id,
            workspaceId,
            version: 0,
            updatedAt: Date.now(),
            data: item as unknown as Record<string, unknown>,
          })),
        });
      } catch (error) {
        console.warn("Couldn't refresh offline materials", error);
      }
    }
  } catch (error) {
    if (sequence === loadSequence) {
      materials.value = [];
      loadError.value =
        error instanceof Error
          ? error.message
          : "Materials couldn't be loaded. Please try again.";
    }
  } finally {
    if (sequence === loadSequence) loading.value = false;
  }
}

async function refreshWorkspaceState() {
  await refreshWorkspaces();
  await load();
}

function hasUploadIntent(value: typeof route.query.upload) {
  return Array.isArray(value) ? value.length > 0 : value != null;
}

function clearUploadIntent() {
  const { upload: _upload, capture: _capture, ...query } = route.query;
  void _upload;
  void _capture;
  void navigateTo({ path: route.path, query }, { replace: true });
}

function consumeUploadRoute(value: typeof route.query.upload) {
  if (!hasUploadIntent(value) || !canUpload.value || !activeId.value) return;
  const token = `${route.query.capture ?? ""}:${activeId.value}`;
  if (lastUploadToken.value === token) return;
  lastUploadToken.value = token;
  pick();
  clearUploadIntent();
}

watch([activeId, () => offline.isOnline.value], () => void load());
watch(
  [() => route.query.upload, () => route.query.capture, activeId],
  ([upload]) => {
    consumeUploadRoute(upload);
  },
);

onMounted(async () => {
  await load();
  consumeUploadRoute(route.query.upload);
});
</script>

<style scoped>
.mats {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  padding-bottom: var(--space-6);
}

.mats__wspill {
  align-self: flex-start;
  margin-top: var(--space-2);
}

.mats__uploading {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  padding: var(--space-4);
  border-radius: var(--radius-lg);
  background: var(--color-surface-subtle);
  border: 1px solid var(--color-secondary);
}

.mats__upload-head,
.mats__section-head,
.mats__draft-actions,
.mats__modal-actions {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.mats__upload-head,
.mats__section-head {
  justify-content: space-between;
}

.mats__progress {
  height: 8px;
  overflow: hidden;
  border-radius: var(--radius-full);
  background: var(--color-secondary);
}

.mats__progress span {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: var(--color-primary);
  transition: width var(--duration-normal) var(--ease-standard);
}

.mats__drafts {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  padding: var(--space-4);
  border: 1px dashed var(--color-border-strong);
  border-radius: var(--radius-lg);
  background: var(--color-surface-subtle);
}

.mats__list {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  list-style: none;
  padding: 0;
  margin: 0;
}

.mats__row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: var(--space-1);
}

.mats__modal-actions {
  justify-content: flex-end;
}

@media (prefers-reduced-motion: reduce) {
  .mats__progress span {
    transition: none;
  }
}
</style>

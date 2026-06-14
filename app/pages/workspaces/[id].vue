<script setup lang="ts">
import BoardNotesSection from "~/features/board/containers/BoardNotesSection.vue";
import NotesSection from "~/features/notes/containers/NotesSection.vue";
import ReviewStatusCard from "~/features/review/components/ReviewStatusCard.vue";
import WorkspaceImportDialog from "~/features/integrations/components/WorkspaceImportDialog.vue";
import { useRoute } from "vue-router";
import { defineAsyncComponent, onMounted, onBeforeUnmount } from "vue";
import { useWorkspace } from "~/composables/workspaces/useWorkspaces";
import type { EnrollCardResponse } from "~/shared/utils/review.contract";
import { cleanupNotesStore } from "~/features/notes/composables/useNotesStore";
import { useBoardColumnsStore } from "~/features/board/composables/useBoardColumnsStore";
import { useBoardItemsStore } from "~/features/board/composables/useBoardItemsStore";
import { useNoteGroupsStore } from "~/features/notes/composables/useNoteGroupsStore";
import { useNotesStore } from "~/features/notes/composables/useNotesStore";

const ContextSlideOver = defineAsyncComponent(
  () => import("~/components/workspace/hub/ContextSlideOver.vue")
);

const LearningHubContent = defineAsyncComponent(
  () => import("~/components/workspace/hub/LearningHubContent.vue")
);

const WorkspaceUploadMaterialForm = defineAsyncComponent(
  () => import("~/features/materials/components/UploadMaterialForm.vue")
);

const route = useRoute();
const id = route.params.id;
const workspaceId = `${id as string}`;
const toast = useToast();
const { data: authData } = useAuth();
const showUpload = ref(false);
const { workspace, loading, error, refresh } = useWorkspace(id! as string);
const boardColumnsStore = useBoardColumnsStore(workspaceId);
const boardItemsStore = useBoardItemsStore(workspaceId);
const notesStore = useNotesStore(workspaceId);
const noteGroupsStore = useNoteGroupsStore(workspaceId);

// Context Bridge integration
const contextBridge = useContextBridge();

// Layout ref for programmatic tab switching
const layoutRef = ref<InstanceType<typeof import('~/components/workspace/WorkspaceLayout.vue').default> | null>(null);

const { updateWorkspace, updating, typedError } = useUpdateWorkspace();
const { fetchMaterials: refreshMaterials } = useMaterialsStore(id as string);
const {
  enrolledFlashcardIds,
  enrolledQuestionIds,
  onEnrolled,
  loading: enrollmentLoading,
  fetchEnrollments
} = useWorkspaceEnrollment(id as string, workspace);

const { handleOfflineSubmit } = useOffline();

const integrationStatusToColumnId = computed(() => {
  const columns = boardColumnsStore.getOrderedColumns();
  const findColumn = (...needles: string[]) =>
    columns.find((column) => {
      const name = column.name.toLowerCase();
      return needles.some((needle) => name.includes(needle));
    })?.id ?? null;

  return {
    "To Do": findColumn("todo", "to do", "backlog", "task"),
    "In Progress": findColumn("progress", "doing"),
    Done: findColumn("done", "complete"),
  };
});

async function handleWorkspaceImportSynced() {
  await Promise.allSettled([
    boardItemsStore.syncWithServer(),
    boardColumnsStore.syncWithServer(),
    noteGroupsStore.syncWithServer(),
    notesStore.refreshFromServer(),
  ]);
}

function toggleUploadForm() {
  console.log("toggleUploadForm");
  showUpload.value = !showUpload.value;
}

// Handle adding selected text to material
const handleAddToMaterial = async (selectedText: string) => {
  console.log("Add to material from NotesSection:", selectedText);

  const title = selectedText.slice(0, 50); // Use first 50 chars as title
  const content = selectedText;
  const type = "text";
  await saveMaterial(title, content, type);
};

const saveMaterial = async (title: string, content: string, type: string) => {
  try {
    const payload = {
      id: id as string,
      materialTitle: title,
      materialContent: content,
      materialType: type,
    };
    // handle offline case
    if (!navigator.onLine) {
      // Sanitize user data for IndexedDB (only store cloneable properties)
      const userData = authData.value?.user
        ? {
          email: authData.value.user.email,
          name: authData.value.user.name,
          image: authData.value.user.image,
          // Only include primitive/serializable properties
        }
        : null;

      handleOfflineSubmit({
        payload: { ...payload, workspaceId: id as string, user: userData },
        storeName: DB_CONFIG.STORES.FORMS,
        type: FORM_SYNC_TYPES.UPLOAD_MATERIAL,
      });
      return;
    }
    handleOpenLearningHub();

    await updateWorkspace(payload);
    await refreshMaterials();
    toast.add({
      title: "Saved",
      description: "Material uploaded to this workspace.",
      color: "success",
    });
  } catch (err: unknown) {
    toast.add({
      title: "Error",
      description:
        typedError.value?.message ||
        (err as Error)?.message ||
        "Failed to upload material.",
      color: "error",
    });
  }
};


function handleEnrolled(response: EnrollCardResponse) {
  console.log("Enrollment response:", response);
  if (response.success && response.cardId) {
    window.dispatchEvent(new CustomEvent("refresh-review-stats"));
    fetchEnrollments();
  }
}

// Handle opening Learning Hub from external events (e.g., from notes component)
function handleOpenLearningHub() {
  console.log("handleOpenLearningHub");
  layoutRef.value?.scrollToTab('hub');
}

// Listen for custom events to open Learning Hub
onMounted(() => {
  window.addEventListener('open-learning-hub', handleOpenLearningHub);
});

onBeforeUnmount(() => {
  window.removeEventListener('open-learning-hub', handleOpenLearningHub);
  // Release memory from the notes store cache for this workspace
  cleanupNotesStore(id as string);
});
</script>



<template>
  <shared-page-wrapper id="workspace-page" :title="`${workspace?.title || '....'}`" :is-page-loading="loading">
    <template #header-info-leading>
      <NuxtLink to="/workspaces" class="text-xs text-content-on-background flex items-center gap-1">
        <u-icon name="i-heroicons-chevron-left" class="-ml-1" />
        Back to Workspaces
      </NuxtLink>
    </template>

    <template #actions>
      <div class="flex flex-col items-end gap-2">
        <WorkspaceImportDialog
          :workspace-id="workspaceId"
          default-target="NOTE"
          trigger-label="Apps"
          trigger-size="sm"
          :status-to-column-id="integrationStatusToColumnId"
          @imported="handleWorkspaceImportSynced"
        />
        <!-- Workspace-specific Review Status -->
        <review-status-card :workspace-id="`${id as string}`" :show-context="false" :show-refresh="false"
          :minimal="true" variant="ghost" :empty-message="'You have no cards to review, enroll some or just chill.'" />
      </div>
    </template>
    <shared-error-message v-if="error && !loading" :error="error" :refresh="refresh" />

    <template v-if="workspace" #default>

      <workspace-layout ref="layoutRef" :workspace-id="`${id as string}`">
        <!-- Learning Hub Panel -->
        <template #hub>
          <LearningHubContent :workspace-id="`${id as string}`" :materials-length="workspace.materials?.length"
            :is-enrolling-loading="enrollmentLoading" :enrolled-flashcard-ids="enrolledFlashcardIds"
            :enrolled-question-ids="enrolledQuestionIds" :updating="updating" :show-upload="showUpload"
            @enrolled="handleEnrolled" @toggle-upload="toggleUploadForm" />
        </template>

        <!-- Notes Panel -->
        <template #notes>
          <NotesSection @add-to-material="handleAddToMaterial" />
        </template>

        <!-- Board Panel -->
        <template #board>
          <board-notes-section />
        </template>
      </workspace-layout>

      <!-- Upload Materials Dialog -->
      <WorkspaceUploadMaterialForm :show="showUpload" @close="showUpload = false" />

      <!-- Context Bridge Slide-Over -->
      <ContextSlideOver :is-open="contextBridge.isSlideOverOpen.value" :preview="contextBridge.activePreview.value"
        :is-loading="contextBridge.isLoading.value" @close="contextBridge.closePreview()" />
    </template>
  </shared-page-wrapper>
</template>

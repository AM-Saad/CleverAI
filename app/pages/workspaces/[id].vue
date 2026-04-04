<script setup lang="ts">
import { useRoute } from "vue-router";
import { defineAsyncComponent, onMounted, onBeforeUnmount } from "vue";
import { useWorkspace } from "~/composables/workspaces/useWorkspaces";
import { useResponsive } from "~/composables/ui/useResponsive";
import type { EnrollCardResponse } from "~/shared/utils/review.contract";

const ContextSlideOver = defineAsyncComponent(
  () => import("~/components/workspace/hub/ContextSlideOver.vue")
);

const LearningHubModal = defineAsyncComponent(
  () => import("~/components/workspace/hub/LearningHubModal.vue")
);
const FloatingLearningHubButton = defineAsyncComponent(
  () => import("~/components/workspace/hub/FloatingLearningHubButton.vue")
);

const LearningHubContent = defineAsyncComponent(
  () => import("~/components/workspace/hub/LearningHubContent.vue")
);
// const WorkspaceNotesSection = defineAsyncComponent(
//   () => import("~/components/workspace/NotesSection.vue"),
// );
const WorkspaceUploadMaterialForm = defineAsyncComponent(
  () => import("~/components/workspace/hub/materials/UploadMaterialForm.vue")
);

const route = useRoute();
const id = route.params.id;
const toast = useToast();
const { data: authData } = useAuth();
const showUpload = ref(false);
const { workspace, loading, error, refresh } = useWorkspace(id! as string);

// Context Bridge integration
const contextBridge = useContextBridge();

// Responsive behavior
const { isMobile } = useResponsive();
const showLearningHubModal = ref(false);

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
  if (isMobile.value) {
    showLearningHubModal.value = true;
  } else {
    const hub = document.getElementById('learning-hub');
    hub?.scrollIntoView({ behavior: 'smooth' });
  }
}

// Listen for custom events to open Learning Hub
onMounted(() => {
  window.addEventListener('open-learning-hub', handleOpenLearningHub);
});

onBeforeUnmount(() => {
  window.removeEventListener('open-learning-hub', handleOpenLearningHub);
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
        <!-- Workspace-specific Review Status -->
        <review-status-card :workspace-id="`${id as string}`" :show-context="false" :show-refresh="false"
          :minimal="true" variant="ghost" :empty-message="'You have no cards to review, enroll some or just chill.'" />
      </div>
    </template>
    <shared-error-message v-if="error && !loading" :error="error" :refresh="refresh" />

    <template v-if="workspace" #default>

      <div class="flex flex-col md:flex-row gap-2 min-h-0 min-w-0 grow">


        <!-- LEARNING HUB Goes Here - Desktop Only -->
        <div v-if="!isMobile" class="flex flex-col relative overflow-hidden basis-1/3 shrink-0" id="learning-hub">
          <LearningHubContent :workspace-id="`${id as string}`" :materials-length="workspace.materials?.length"
            :is-enrolling-loading="enrollmentLoading" :enrolled-flashcard-ids="enrolledFlashcardIds"
            :enrolled-question-ids="enrolledQuestionIds" :updating="updating" :show-upload="showUpload"
            @enrolled="handleEnrolled" @toggle-upload="toggleUploadForm" />
        </div>

        <!-- NOTES Goes Here -->
        <workspace-notes-section @add-to-material="handleAddToMaterial" />

        <board-notes-section />

      </div>

      <!-- Mobile Learning Hub Modal -->
      <LearningHubModal :show="showLearningHubModal" :workspace-id="`${id as string}`"
        :materials-length="workspace.materials?.length" :enrollment-loading="enrollmentLoading"
        :enrolled-flashcard-ids="enrolledFlashcardIds" :enrolled-question-ids="enrolledQuestionIds" :updating="updating"
        :show-upload="showUpload" @close="showLearningHubModal = false" @enrolled="handleEnrolled"
        @toggle-upload="toggleUploadForm" />

      <!-- Floating Action Button - Mobile Only -->
      <FloatingLearningHubButton :visible="isMobile" @click="handleOpenLearningHub" />

      <!-- Upload Materials Dialog -->
      <WorkspaceUploadMaterialForm :show="showUpload" @close="showUpload = false" />

      <!-- Context Bridge Slide-Over -->
      <ContextSlideOver :is-open="contextBridge.isSlideOverOpen.value" :preview="contextBridge.activePreview.value"
        :is-loading="contextBridge.isLoading.value" @close="contextBridge.closePreview()" />
    </template>
  </shared-page-wrapper>
</template>

<script setup lang="ts">
import { useRoute } from "vue-router";
import { defineAsyncComponent, onMounted, onBeforeUnmount } from "vue";
import { useFolder } from "~/composables/folders/useFolders";
import { useResponsive } from "~/composables/ui/useResponsive";
import type { EnrollCardResponse } from "~/shared/utils/review.contract";


const FlashCards = defineAsyncComponent(
  () => import("~/components/folder/FlashCards.vue")
);
const Questions = defineAsyncComponent(
  () => import("~/components/folder/Questions.vue")
);

const MaterialsList = defineAsyncComponent(
  () => import("~/components/folder/MaterialsList.vue")
);
const LearningHubModal = defineAsyncComponent(
  () => import("~/components/folder/LearningHubModal.vue")
);
const FloatingLearningHubButton = defineAsyncComponent(
  () => import("~/components/folder/FloatingLearningHubButton.vue")
);

const LearningHubContent = defineAsyncComponent(
  () => import("~/components/folder/LearningHubContent.vue")
);
// const FolderNotesSection = defineAsyncComponent(
//   () => import("~/components/folder/NotesSection.vue"),
// );
const FolderUploadMaterialForm = defineAsyncComponent(
  () => import("~/components/folder/UploadMaterialForm.vue")
);

const route = useRoute();
const id = route.params.id;
const toast = useToast();
const { data: authData } = useAuth();
const showUpload = ref(false);
const { folder, loading, error, refresh } = useFolder(id! as string);

// Responsive behavior
const { isMobile } = useResponsive();
const showLearningHubModal = ref(false);

const { updateFolder, updating, typedError } = useUpdateFolder();
const { fetchMaterials: refreshMaterials } = useMaterialsStore(id as string);
const {
  enrolledFlashcardIds,
  enrolledQuestionIds,
  onEnrolled,
  loading: enrollmentLoading,
  fetchEnrollments
} = useFolderEnrollment(id as string, folder);

const { handleOfflineSubmit } = useOffline();

function toggleUploadForm() {
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
        payload: { ...payload, folderId: id as string, user: userData },
        storeName: DB_CONFIG.STORES.FORMS,
        type: FORM_SYNC_TYPES.UPLOAD_MATERIAL,
      });
      return;
    }
    handleOpenLearningHub();

    await updateFolder(payload);
    await refreshMaterials();
    toast.add({
      title: "Saved",
      description: "Material uploaded to this folder.",
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
  <shared-page-wrapper id="folder-page" :title="`${folder?.title || '....'}`" :is-page-loading="loading">
    <!-- <template #header-info>
      <ui-label class="mt-2" variant="muted">Created: {{ createdAt }}</ui-label>

    </template> -->
    <template #actions>
      <div class="flex flex-col items-end gap-2">
        <!-- Folder-specific Review Status - Minimal & Clean -->
        <review-status-card :folder-id="`${id as string}`" :show-context="false" :show-refresh="false" :minimal="true"
          variant="ghost" :empty-message="'You have no cards to review, enroll some or just chill.'" />
      </div>

    </template>
    <shared-error-message v-if="error && !loading" :error="error" :refresh="refresh" />

    <template v-if="folder" #default>

      <div class="flex flex-col md:flex-row gap-2 min-h-0 w-full grow">


        <!-- NOTES Goes Here -->
        <folder-notes-section @add-to-material="handleAddToMaterial" />


        <!-- LEARNING HUB Goes Here - Desktop Only -->
        <div v-if="!isMobile" class="flex flex-col relative overflow-hidden shrink-0 basis-full md:basis-1/4 grow"
          id="learning-hub">
          <LearningHubContent :folder-id="`${id as string}`" :materials-length="folder.materials?.length"
            :is-enrolling-loading="enrollmentLoading" :enrolled-flashcard-ids="enrolledFlashcardIds"
            :enrolled-question-ids="enrolledQuestionIds" :updating="updating" :show-upload="showUpload"
            @enrolled="handleEnrolled" @toggle-upload="toggleUploadForm" />
        </div>
      </div>

      <!-- Mobile Learning Hub Modal -->
      <LearningHubModal :show="showLearningHubModal" :folder-id="`${id as string}`"
        :materials-length="folder.materials?.length" :enrollment-loading="enrollmentLoading"
        :enrolled-flashcard-ids="enrolledFlashcardIds" :enrolled-question-ids="enrolledQuestionIds" :updating="updating"
        :show-upload="showUpload" @close="showLearningHubModal = false" @enrolled="handleEnrolled"
        @toggle-upload="toggleUploadForm" />

      <!-- Floating Action Button - Mobile Only -->
      <FloatingLearningHubButton :visible="isMobile" @click="handleOpenLearningHub" />

      <!-- Upload Materials Dialog -->
      <FolderUploadMaterialForm :show="showUpload" @close="toggleUploadForm" />
    </template>
  </shared-page-wrapper>
</template>

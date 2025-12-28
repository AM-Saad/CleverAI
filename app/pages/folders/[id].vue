<script setup lang="ts">
import { useRoute } from "vue-router";
import { defineAsyncComponent } from "vue";
import { useFolder } from "~/composables/folders/useFolders";
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
const activeIndex = ref(0);
const carousel = useTemplateRef("carousel");
const { folder, loading, error, refresh } = useFolder(id! as string);

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


const items = [
  {
    name: "Questions",
    icon: "bi:question-circle",
    component: Questions,
  },
  {
    name: "Flash Cards",
    icon: "bi:card-text",
    component: FlashCards,
  },
];


function select(index: number) {
  activeIndex.value = index;

  carousel.value?.emblaApi?.scrollTo(index);
}

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
// --- Enrollment Logic ---

const currentEnrolledIds = computed(() => {
  // Assuming index 0 is Questions, 1 is Flashcards based on `items` array
  if (activeIndex.value === 0) return enrolledQuestionIds.value;
  return enrolledFlashcardIds.value;
});




function handleEnrolled(response: EnrollCardResponse) {
  console.log("Enrollment response:", response);
  if (response.success && response.cardId) {
    window.dispatchEvent(new CustomEvent("refresh-review-stats"));
    fetchEnrollments();
    // Determine type based on active tab
    const type = activeIndex.value === 0 ? 'question' : 'flashcard';
    onEnrolled(response, type);
  }
}
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


        <!-- LEARNING HUB Goes Here -->
        <div class="flex flex-col relative overflow-hidden shrink-0 basis-full md:basis-1/4 grow" id="learning-hub">
          <ui-gradient-bg />
          <ui-card variant="ghost" size="lg"
            class="relative bg-white m-[1.5px] dark:m-px dark:bg-dark flex-1 shrink-0 overflow-scroll"
            content-classes="h-full flex flex-col">
            <template #header>
              <div class="flex items-center gap-1">
                <icons-stars-generative />
                Learning Hub
                <u-tooltip
                  text="Upload New Material, or select part of the text from your note to create a study material that you can generate flashcard, and question from it to feed the Spaced Repetition Engine">
                  <icon name="i-lucide-info" :size="UI_CONFIG.ICON_SIZE" class=" text-muted dark:text-neutral" />
                </u-tooltip>
              </div>
              <u-button variant="subtle" size="xs" :aria-expanded="showUpload" aria-controls="upload-materials"
                @click="toggleUploadForm" title="Create New Study Material">
                New Study Material
              </u-button>
            </template>

            <template #default>


              <ui-card class="overflow-auto grow-0 mb-4" size="sm" variant="outline">
                <u-collapsible>

                  <div class="flex items-center gap-1 select-none cursor-pointer text-sm font-medium dark:text-light">
                    <div v-if="updating" class="flex items-center gap-1 text-primary">
                      <icon name="i-lucide-loader" class="w-4 h-4 animate-spin" />
                    </div>
                    Materials
                    <icon name="i-lucide-chevrons-up-down" :size="UI_CONFIG.ICON_SIZE"
                      class=" text-muted dark:text-neutral" />

                  </div>
                  <template #content>
                    <MaterialsList :folder-id="`${id as string}`" @removed="() => { }"
                      @error="(e) => console.error(e)" />
                  </template>
                </u-collapsible>
              </ui-card>

              <ui-card class="flex grow-0 shrink-0 basis-3/4 min-h-0"
                content-classes=" basis-full overflow-y-hidden! flex flex-col" variant="ghost" size="xs">
                <template #default>
                  <ui-tabs v-model="activeIndex" :items="items" @select="select" direction="row" />
                  <component :is="items[activeIndex]!.component" :materialsLength="folder.materials?.length"
                    :isEnrollingLoading="enrollmentLoading" :enrolled-ids="currentEnrolledIds"
                    @enrolled="handleEnrolled" />
                </template>
              </ui-card>
            </template>
          </ui-card>
        </div>
      </div>

      <!-- Upload Materials Dialog -->
      <FolderUploadMaterialForm :show="showUpload" @close="toggleUploadForm" />
    </template>
  </shared-page-wrapper>
</template>

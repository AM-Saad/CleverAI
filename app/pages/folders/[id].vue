<script setup lang="ts">
import { useRoute } from "vue-router";
import { defineAsyncComponent } from "vue";
import { useFolder } from "~/composables/folders/useFolders";

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

const { updateFolder, updating, typedError } = useUpdateFolder(id as string);
const { fetchMaterials: refreshMaterials } = useMaterialsStore(id as string);
const { handleOfflineSubmit } = useOffline();

const createdAt = computed(() =>
  useNuxtLocaleDate(
    new Date(folder.value?.createdAt || new Date().toISOString())
  )
);

const existingFlashcards = computed(
  () => (folder.value as Folder | null | undefined)?.flashcards || []
);

const cardsToShow = computed(() =>
  folder.value?.flashcards?.length
    ? folder.value.flashcards
    : existingFlashcards.value
);

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

function onClickPrev() {
  activeIndex.value = Math.max(activeIndex.value - 1, 0);
}
function onClickNext() {
  activeIndex.value = Math.min(activeIndex.value + 1, items.length - 1);
}
function onSelect(index: number) {
  activeIndex.value = index;
}

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
                  </div>
                  <template #content>
                    <MaterialsList :folder-id="`${id as string}`" @removed="() => { }"
                      @error="(e) => console.error(e)" />
                  </template>
                </u-collapsible>
              </ui-card>

              <ui-card class="flex grow-0 shrink-0 basis-3/4 min-h-0"
                content-classes=" basis-full overflow-y-hidden! flex flex-col" variant="ghost" size="xs">
                <!-- <template #header>
                  Study Tools
                </template> -->
                <template #default>
                  <ui-tabs v-model="activeIndex" :items="items" @select="select" direction="row" />
                  <component :is="items[activeIndex]!.component" :materialsLength="folder.materials?.length" />
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

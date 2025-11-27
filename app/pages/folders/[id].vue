<template>
  <shared-page-wrapper id="folder-page" :title="`Folder: ${folder?.title || '....'}`"
    :subtitle="folder?.description || ''" :is-page-loading="loading">
    <template #actions>
      <ui-label class="mt-2" variant="muted"> {{ createdAt }} </ui-label>
    </template>
    <shared-error-message v-if="error && !loading" :error="error" :refresh="refresh" />

    <template v-if="folder" #default>

      <div class="flex flex-col lg:flex-row  gap-2 min-h-0 w-full grow">

      <!-- NOTES Goes Here -->
        <folder-notes-section @add-to-material="handleAddToMaterial" />

        <!-- LEARNING HUB Goes Here -->
        <!-- <div class="relative flex-1 col-span-1 lg:col-span-2"> -->
        <div class="flex flex-col relative overflow-hidden shrink-0  lg:basis-1/3">
          <!-- <ui-gradient-bg /> -->
          <ui-gradient-bg />

          <ui-card variant="ghost" size="lg"
            class="relative bg-white m-[1.5px] dark:m-px dark:bg-dark flex-1 shrink-0 overflow-scroll"
            content-classes="h-full flex flex-col">

            <template #header>
              Learning Hub
              <!-- Review Navigation -->
              <div v-if="cardsToShow?.length">
                <u-button to="/user/review" size="sm">
                  <svg class="h-2 w-2" fill="none" s troke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
                  </svg>
                  Start Review
                </u-button>
              </div>
            </template>

            <template #default>
              <ui-card class="overflow-auto mb-4 grow-0 basis-1/3" size="md" variant="outline">
                <template #header>
                  <div class="flex items-center gap-1">
                    <div v-if="updating" class="flex items-center gap-1 text-primary">
                      <svg class="animate-spin h-2.5 w-2.5" fill="none" viewBox="0 0 24 24">
                        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
                        <path class="opacity-75" fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                    </div>
                    Materials
                  </div>
                  <u-button variant="subtle" size="xs" :aria-expanded="showUpload" aria-controls="upload-materials"
                    @click="toggleUploadForm">
                    Add New
                  </u-button>
                </template>

                <MaterialsList :folder-id="`${id as string}`" @removed="() => { }" @error="(e) => console.error(e)" />
              </ui-card>

              <ui-card class="overflow-auto flex  dark:bg-dark! grow-0 shrink-0 basis-2/3"
                content-classes="p-0 h-full flex flex-col"
              size="sm">
                
                <ui-tabs v-model="activeIndex" :items="items" @select="select" direction="row" />

                <UCarousel ref="carousel" v-slot="{ item }" :items="items" :prev="{ onClick: onClickPrev }"
                  :next="{ onClick: onClickNext }" :ui="{ item: 'ps-0 flex grow', container: '-ms-0 flex  flex grow', root: 'flex grow' }" @select="onSelect">

                  <component :is="item.component" :materialsLength="folder.materials?.length" />
                </UCarousel>

              </ui-card>

            </template>

          </ui-card>


        </div>
  

      </div>

      <!-- Upload Materials -->
      <!-- <FolderUploadMaterialForm :show="showUpload" :backdrop="false" @close="toggleUploadForm" /> -->
    </template>

  </shared-page-wrapper>
</template>

<script setup lang="ts">
import { useRoute } from "vue-router";
import { defineAsyncComponent } from "vue";
import { useFolder } from "~/composables/folders/useFolders";

const FlashCards = defineAsyncComponent(
  () => import("~/components/folder/FlashCards.vue"),
);
const Questions = defineAsyncComponent(
  () => import("~/components/folder/Questions.vue"),
);

const MaterialsList = defineAsyncComponent(
  () => import("~/components/folder/MaterialsList.vue"),
);
// const FolderNotesSection = defineAsyncComponent(
//   () => import("~/components/folder/NotesSection.vue"),
// );
const FolderUploadMaterialForm = defineAsyncComponent(
  () => import("~/components/folder/UploadMaterialForm.vue"),
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
const { refresh: refreshMaterials } = useMaterials(id as string);
const { handleOfflineSubmit } = useOffline();




const createdAt = computed(() =>
  useNuxtLocaleDate(
    new Date(folder.value?.createdAt || new Date().toISOString()),
  ),
);

const existingFlashcards = computed(() => (folder.value as Folder | null | undefined)?.flashcards || []);

const cardsToShow = computed(() => folder.value?.flashcards?.length ? folder.value.flashcards : existingFlashcards.value);

const items = [
  {
    name: "Flash Cards",
    icon: "bi:card-text",
    component: FlashCards,
  },
  {
    name: "Questions",
    icon: "bi:question-circle",
    component: Questions,
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
  const content = selectedText;;
  const type = 'text';
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

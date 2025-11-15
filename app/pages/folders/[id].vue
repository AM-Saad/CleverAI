<template>
    <shared-page-wrapper id="folder-page" :title="`Folder: ${folder?.title || '....'}`"
      :subtitle="folder?.description || ''" :is-page-loading="loading">
      <template #actions>
        <div class="flex flex-col gap-2">
          <span v-if="folder?.llmModel" class="inline-flex items-center text-xs px-0.5 py-0.5 rounded bg-primary">
            Model:
            <span class="ml-1 font-medium"> {{ folder?.llmModel.toLocaleUpperCase() }} </span>
          </span>
          <ui-label class="mt-2" variant="muted"> {{ createdAt }} </ui-label>
        </div>
      </template>
      <shared-error-message v-if="error && !loading" :error="error" :refresh="refresh" />

      <template v-if="folder" #default>


        <div class="md:flex gap-4" style="flex: 1 1 auto; min-height: 0;">


                    <!-- NOTES Goes Here -->
          <FolderNotesSection :folder-id="`${id as string}`" />

          <!-- LEARNING HUB Goes Here -->
          <!-- <div class="relative flex-1 col-span-1 lg:col-span-2"> -->
          <div class="col-span-5 flex flex-col flex-1 relative overflow-hidden">
            <!-- <ui-gradient-bg /> -->
            <ui-gradient-bg />

            <ui-card variant="ghost" size="lg" class="relative bg-white m-[1.5px] dark:m-px dark:bg-dark flex-1 shrink-0 overflow-scroll"
              content-classes="h-full">

              <template #header>
                Learning Hub
                <!-- Review Navigation -->
                <div v-if="cardsToShow?.length">
                  <u-button to="/user/review" size="sm">
                    <svg class="h-2 w-2" fill="none" s  troke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
                    </svg>
                    Start Review
                  </u-button>
                </div>
              </template>

              <template #default>
                <ui-card class="overflow-auto mb-4" size="md" variant="outline">
                  <template #header>
                    Materials
                    <u-button variant="subtle" size="xs" :aria-expanded="showUpload" aria-controls="upload-materials"
                      @click="toggleUploadForm">
                      Add New
                    </u-button>
                  </template>

                  <MaterialsList :folder-id="`${id as string}`" @removed="() => { }" @error="(e) => console.error(e)" />
                </ui-card>

                <ui-card class="overflow-auto  dark:bg-dark!" size="sm">

                  <ui-tabs v-model="activeIndex" :items="items" @select="select" direction="row" />
                  <UCarousel ref="carousel" v-slot="{ item }" :items="items" :prev="{ onClick: onClickPrev }"
                    :next="{ onClick: onClickNext }" :ui="{ item: 'ps-0', container: '-ms-0' }" @select="onSelect">

                    <component :is="item.component" :materialsLength="folder.materials?.length" />
                  </UCarousel>

                </ui-card>

              </template>

            </ui-card>


          </div>


        </div>

      </template>

      <!-- <FolderUploadMaterialForm :show="showUpload" :backdrop="false" @closed="showUpload = false"
        @cancel="showUpload = false" /> -->

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
const FolderNotesSection = defineAsyncComponent(
  () => import("~/components/folder/NotesSection.vue"),
);


const route = useRoute();
const id = route.params.id;
const showUpload = ref(false);
const activeIndex = ref(0);
const carousel = useTemplateRef("carousel");

const { folder, loading, error, refresh } = useFolder(id! as string);

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

</script>

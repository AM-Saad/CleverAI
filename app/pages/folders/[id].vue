<template>
  <div id="folder-page" class="max-h-full">
    <ui-loader :is-fetching="loading" label="Loading Folder..." />

    <shared-error-message v-if="error && !loading" :error="error" :refresh="refresh" />

    <Transition name="fade" mode="out-in" :duration="{ enter: 300, leave: 300 }">
      <div v-if="folder" class="transition-all duration-1000 will-change-auto">

        <UiCard variant="ghost">
          <template v-slot:default>
            <div class="flex flex-col md:flex-row md:justify-between md:items-center gap-4">
              <div>
                <div class="flex flex-wrap items-center gap-2">
                  <icon name="bi:folder" class="inline-block text-primary text-2xl" />
                  <UiTitle>{{ folder?.title }}</UiTitle>
                  <span v-if="folder.llmModel"
                    class="inline-flex items-center text-xs px-0.5 py-0.5 rounded bg-primary">
                    Model:
                    <span class="ml-1 font-medium"> {{ folder.llmModel.toLocaleUpperCase() }} </span>
                  </span>
                  <UiParagraph class="mt-2" variant="muted" size="xs"> {{ createdAt }} </UiParagraph>
                </div>
                <div class="flex flex-col items-start ">
                  <UiParagraph class="mt-2" variant="muted" size="sm">
                    {{ folder?.description ? folder.description : "No description available." }}
                  </UiParagraph>
                </div>
              </div>
            </div>
          </template>
        </UiCard>

        <div class="grid lg:grid-cols-6 gap-4 p-3 ">

          <!-- LEARNING HUB Goes Here -->
          <!-- <div class="relative flex-1 col-span-1 lg:col-span-2  "> -->
          <div class="col-span-5 flex-1 lg:col-span-2 relative">

            <motion.div :initial="{ opacity: 0, height: 0 }" :animate="{ opacity: 1, height: '100%' }" :transition="{
              duration: 1,
              delay: 1,
              height: {
                type: 'spring',

              },
            }" class="absolute animate-pulse bg-gradient-to-r blur-lg dark:from-[#00e2ff]/40 dark:to-red-600/40 from-[#00e2ff]/40 left-3.5 opacity-30 rounded-lg to-red-600/40 transition-all w-[calc(100%-2rem)] will-change-auto">
            </motion.div>

            <!-- animate to h-full -->
            <!-- <div class="absolute left-0 bottom-0 w-full  delay-500 h-full slide-in-from-bottom-translate-full 
               rounded-xl bg-gradient-to-r from-blue-400 via-purple-500 to-pink-500 bg-[length:400%_400%]">
            </div> -->
            <motion.div :initial="{ opacity: 0, height: 0 }" :animate="{ opacity: 1, height: '100%' }" :transition="{
              duration: 1,
              scale: {
                delay: 2,

                type: 'spring',
                bounce: 0.1,
              },
            }"
              class="absolute bg-[length:100%] bg-gradient-to-l bottom-0 from-[#00e2ff]/40 h-full left-0 rounded-xl to-error/50 w-full">
            </motion.div>

            <ui-card variant="ghost" size="sm" class="relative bg-white m-0.5 dark:bg-dark" content-classes="h-full">

              <template #header>
                <div class="flex items-center gap-2">
                  <UiSubtitle size="base">Learning Hub</UiSubtitle>
                  <img src="/assets/images/icons/hub.svg" alt="Learning Hub Illustration" class="w-7 h-7" />
                </div>
              </template>

              <template #default>

                <div class="flex justify-between items-center mb-3">
                  <UiSubtitle size="sm">Materials</UiSubtitle>
                  <UButton variant="subtle" size="xs" :aria-expanded="showUpload" aria-controls="upload-materials"
                    @click="toggleUploadForm">
                    Upload
                  </UButton>
                </div>

                <MaterialsList :folder-id="`${id as string}`" @removed="() => { }" @error="(e) => console.error(e)" />

                <UiTabs v-model="activeIndex" :items="items" @select="select" />
                <UCarousel ref="carousel" v-slot="{ item }" :items="items" :prev="{ onClick: onClickPrev }"
                  :next="{ onClick: onClickNext }" :ui="{ item: 'ps-0', container: '-ms-0' }" @select="onSelect">
                  <div class="rounded overflow-scroll">
                    <component :is="item.component" />
                  </div>
                </UCarousel>

              </template>
            </ui-card>
          </div>

          <!-- NOTES Goes Here -->
          <FolderNotesSection :folder-id="`${id as string}`" />
        </div>

      </div>

    </Transition>
    <FolderUploadMaterialForm :show="showUpload" :backdrop="false" @closed="showUpload = false"
      @cancel="showUpload = false" />

  </div>
</template>

<script setup lang="ts">
import { useRoute } from "vue-router";
import { defineAsyncComponent } from "vue";
import { useFolder } from "~/composables/folders/useFolders";
import { motion } from "motion-v";

// Define page meta for authentication
definePageMeta({
  middleware: "role-auth", // Use the role-auth middleware
});

const FlashCards = defineAsyncComponent(
  () => import("~/components/folder/FlashCards.vue"),
);
const Questions = defineAsyncComponent(
  () => import("~/components/folder/Questions.vue"),
);

const route = useRoute();
const showUpload = ref(false);
const id = route.params.id;
const { folder, loading, error, refresh } = useFolder(id! as string);
const createdAt = computed(() =>
  useNuxtLocaleDate(
    new Date(folder.value?.createdAt || new Date().toISOString()),
  ),
);

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

watch(error, (newError) => {
  if (newError) {
    console.error("Error fetching folder:", newError.stack);
  }
});
const carousel = useTemplateRef("carousel");
const activeIndex = ref(0);

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

const MaterialsList = defineAsyncComponent(
  () => import("~/components/folder/MaterialsList.vue"),
);
const FolderNotesSection = defineAsyncComponent(
  () => import("~/components/folder/NotesSection.vue"),
);
</script>

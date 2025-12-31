<template>
  <div class="flex flex-col relative overflow-hidden h-full">
    <ui-gradient-bg />
    <ui-card variant="ghost" size="lg"
      class="relative bg-white m-[2px] dark:m-px dark:bg-dark flex-1 shrink min-h-0 overflow-hidden"
      content-classes="h-full flex flex-col p-0">
      <template #header>
        <div class="flex items-center gap-1">
          <icons-stars-generative />
          <span class="font-semibold">Learning Hub</span>
          <u-tooltip
            text="Upload New Material, or select part of the text from your note to create a study material that you can generate flashcard, and question from it to feed the Spaced Repetition Engine">
            <icon name="i-lucide-info" :size="UI_CONFIG.ICON_SIZE" class="text-muted dark:text-neutral" />
          </u-tooltip>
        </div>
        <u-button variant="subtle" size="xs" :aria-expanded="showUpload" aria-controls="upload-materials"
          @click="$emit('toggle-upload')" title="Create New Study Material">
          New Study Material
        </u-button>
      </template>

      <template #default>
        <div class="flex-1 flex flex-col min-h-0 overflow-hidden p-4 gap-4">
          <!-- Materials List Section -->
          <ui-card class="shrink-0 max-h-[30%]" size="sm" variant="outline"
            content-classes="flex flex-col min-h-0 overflow-hidden">
            <u-collapsible class="flex flex-col min-h-0">
              <div class="flex items-center gap-1 select-none cursor-pointer text-sm font-medium dark:text-light p-2">
                <div v-if="updating" class="flex items-center gap-1 text-primary">
                  <icon name="i-lucide-loader" class="w-4 h-4 animate-spin" />
                </div>
                Materials
                <icon name="i-lucide-chevrons-up-down" :size="UI_CONFIG.ICON_SIZE"
                  class="text-muted dark:text-neutral" />
              </div>
              <template #content>
                <div class="overflow-auto max-h-48 border-t border-muted">
                  <MaterialsList :folder-id="folderId" @removed="() => { }" @error="(e) => console.error(e)" />
                </div>
              </template>
            </u-collapsible>
          </ui-card>

          <!-- Tabs and Interactive Content -->
          <ui-card class="flex-1 min-h-0" content-classes="h-full flex flex-col overflow-hidden" variant="ghost"
            size="xs">
            <template #default>
              <ui-tabs v-model="activeIndex" :items="items" @select="select" direction="row" class="shrink-0 mb-2" />
              <div class="flex-1 overflow-y-auto overflow-x-hidden min-h-0 custom-scrollbar pb-4">
                <component :is="items[activeIndex]!.component" :materialsLength="materialsLength"
                  :isEnrollingLoading="isEnrollingLoading" :enrolled-ids="currentEnrolledIds"
                  @enrolled="$emit('enrolled', $event)" />
              </div>
            </template>
          </ui-card>
        </div>
      </template>
    </ui-card>
  </div>
</template>

<script setup lang="ts">
import { defineAsyncComponent, ref, computed } from "vue";
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

interface Props {
  folderId: string;
  materialsLength?: number;
  isEnrollingLoading: boolean;
  enrolledFlashcardIds: Set<string>;
  enrolledQuestionIds: Set<string>;
  updating: boolean;
  showUpload: boolean;
}

const props = defineProps<Props>();

defineEmits<{
  enrolled: [response: EnrollCardResponse];
  "toggle-upload": [];
}>();

const activeIndex = ref(0);
const carousel = useTemplateRef("carousel");

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

const currentEnrolledIds = computed(() => {
  if (activeIndex.value === 0) return props.enrolledQuestionIds;
  return props.enrolledFlashcardIds;
});

function select(index: number) {
  activeIndex.value = index;
  carousel.value?.emblaApi?.scrollTo(index);
}
</script>

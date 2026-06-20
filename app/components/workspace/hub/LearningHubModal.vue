<template>
  <Teleport to="body">
    <div v-if="show" class="fixed inset-0 z-[var(--z-modal)] flex items-center p-4 justify-center overflow-hidden" role="dialog"
      aria-modal="true" aria-labelledby="learning-hub-modal-title">

      <!-- Backdrop with independent opacity transition -->
      <Transition enter-active-class="transition-opacity duration-300 ease-out" enter-from-class="opacity-0"
        enter-to-class="opacity-100" leave-active-class="transition-opacity duration-200 ease-in"
        leave-from-class="opacity-100" leave-to-class="opacity-0" appear>
        <div v-if="show" class="absolute inset-0 bg-[var(--ds-backdrop-dim)] backdrop-blur-md" @click="handleClose"></div>
      </Transition>
      <!-- Close Button - Premium Glass Style -->
      <UiIconButton
        icon="i-lucide-x"
        label="Close Learning Hub"
        size="sm"
        variant="soft"
        class="absolute top-4 right-6 z-20 backdrop-blur-xl active:scale-[0.98]"
        @click="handleClose"
      />

      <!-- Modal Content with spring-like transition and GPU acceleration -->
      <Transition enter-active-class="transition-transform duration-500 cubic-bezier(0.16, 1, 0.3, 1)"
        enter-from-class="translate-y-full" enter-to-class="translate-y-0"
        leave-active-class="transition-transform duration-300 ease-in" leave-from-class="translate-y-0"
        leave-to-class="translate-y-full" appear>
        <UiOverlaySurface
          v-if="show"
          kind="modal"
          layer="modal"
          size="xs"
          class-name="relative flex h-[85dvh] w-full flex-col border-white/20 dark:border-white/5 will-change-transform p-0"
          @click.stop>

          <!-- Drag Handle / Indicator -->
          <!-- <div class="w-full h-8 flex items-center justify-center shrink-0 cursor-grab active:cursor-grabbing">
            <div class="w-12 h-1.5 rounded-full bg-secondary dark:bg-[var(--color-content-on-background)] shadow-[var(--shadow-dropdown)]"></div>
          </div> -->


          <!-- Learning Hub Content Container -->
          <div class="flex-1 overflow-hidden h-full flex flex-col">
            <LearningHubContent :workspace-id="workspaceId" :materials-length="materialsLength"
              :is-enrolling-loading="enrollmentLoading" :enrolled-flashcard-ids="enrolledFlashcardIds"
              :enrolled-question-ids="enrolledQuestionIds" :updating="updating" :show-upload="showUpload"
              @enrolled="handleEnrolled" @toggle-upload="toggleUploadForm" />
          </div>
        </UiOverlaySurface>
      </Transition>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { watch, onMounted, onBeforeUnmount } from "vue";
import type { EnrollCardResponse } from "~/shared/utils/review.contract";
import LearningHubContent from "./LearningHubContent.vue";

interface Props {
  show: boolean;
  workspaceId: string;
  materialsLength?: number;
  enrollmentLoading: boolean;
  enrolledFlashcardIds: Set<string>;
  enrolledQuestionIds: Set<string>;
  updating: boolean;
  showUpload: boolean;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  close: [];
  enrolled: [response: EnrollCardResponse];
  "toggle-upload": [];
}>();

function handleClose() {
  emit("close");
}

function toggleUploadForm() {
  emit("toggle-upload");
}

function handleEnrolled(response: EnrollCardResponse) {
  emit("enrolled", response);
}

// Handle ESC key to close modal
function handleKeydown(e: KeyboardEvent) {
  if (e.key === "Escape" && props.show) {
    handleClose();
  }
}

// Prevent body scroll when modal is open
watch(
  () => props.show,
  (isOpen) => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
  }
);

onMounted(() => {
  document.addEventListener("keydown", handleKeydown);
});

onBeforeUnmount(() => {
  document.removeEventListener("keydown", handleKeydown);
  document.body.style.overflow = "";
});
</script>

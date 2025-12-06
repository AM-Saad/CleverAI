<script setup lang="ts">
interface Props {
  show: boolean;
  flashcardId: string;
  isEnrolled: boolean;
}

const props = defineProps<Props>();
const emit = defineEmits<{
  (event: "close"): void;
  (event: "deleted"): void;
}>();

const { deleteFlashcard, isDeleting } = useDeleteFlashcard();

async function handleConfirmDelete() {
  if (isDeleting.value) return;

  const result = await deleteFlashcard(props.flashcardId);

  if (result) {
    emit("deleted");
    emit("close");
  }
}

function handleClose() {
  if (!isDeleting.value) {
    emit("close");
  }
}
</script>

<template>
  <shared-dialog-modal :show="show" @close="handleClose">
    <template #header>
      <div class="flex items-center gap-2">
        <Icon name="i-lucide-trash-2" class="w-5 h-5 text-error" />
        <span class="font-semibold">Delete Flashcard</span>
      </div>
    </template>

    <template #body>
      <div class="space-y-4">
        <p class="text-sm text-muted">
          Are you sure you want to delete this flashcard? This action cannot be undone.
        </p>

        <!-- Warning if enrolled -->
        <div v-if="isEnrolled" class="flex items-start gap-3 p-3 rounded-lg bg-warning/10 border border-warning/20">
          <Icon name="i-lucide-alert-triangle" class="w-5 h-5 text-warning shrink-0 mt-0.5" />
          <div class="text-sm">
            <p class="font-medium text-warning">This card is enrolled in your review queue</p>
            <p class="text-muted mt-1">
              Deleting this card will also remove all your study progress, including spaced repetition data and review
              history.
            </p>
          </div>
        </div>
      </div>
    </template>

    <template #footer>
      <div class="flex gap-3 justify-end pt-2">
        <UButton variant="ghost" color="neutral" @click="handleClose" :disabled="isDeleting">
          Cancel
        </UButton>
        <UButton color="error" @click="handleConfirmDelete" :loading="isDeleting" :disabled="isDeleting">
          <Icon name="i-lucide-trash-2" class="w-4 h-4 mr-1" />
          Delete Flashcard
        </UButton>
      </div>
    </template>
  </shared-dialog-modal>
</template>

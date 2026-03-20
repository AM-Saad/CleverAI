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
</script>

<template>
  <shared-delete-confirmation-modal :show="show" title="Delete Flashcard" :is-enrolled="isEnrolled"
    enrollment-warning="This card is enrolled in your review queue" @close="$emit('close')"
    @confirm="handleConfirmDelete" :loading="isDeleting">
    Are you sure you want to delete this flashcard? This action cannot be undone.
  </shared-delete-confirmation-modal>
</template>

// app/composables/flashcards/useDeleteFlashcard.ts
import type { DeleteFlashcardResponse } from "@@/shared/utils/flashcard.contract";
import { useOperation } from "../shared/useOperation";

export function useDeleteFlashcard() {
  const { $api } = useNuxtApp();
  const toast = useToast();

  const operation = useOperation<DeleteFlashcardResponse>();

  async function deleteFlashcard(id: string) {
    const result = await operation.execute(() =>
      $api.folders.deleteFlashcard(id)
    );

    if (result) {
      const reviewsDeleted = result.deletedReviewsCount || 0;
      const message =
        reviewsDeleted > 0
          ? `Flashcard and ${reviewsDeleted} review record(s) deleted.`
          : "Flashcard deleted successfully.";

      toast.add({
        title: "Flashcard Deleted",
        description: message,
        color: "success",
      });
    } else if (operation.error.value) {
      toast.add({
        title: "Error",
        description:
          operation.error.value.message || "Failed to delete flashcard",
        color: "error",
      });
    }

    return result;
  }

  return {
    deleteFlashcard,
    isDeleting: operation.pending,
    error: operation.error,
  };
}

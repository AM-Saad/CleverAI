// app/composables/flashcards/useDeleteFlashcard.ts

export interface DeleteFlashcardResult {
  success: boolean;
  deletedReviewsCount?: number;
}

export function useDeleteFlashcard() {
  const { $api } = useNuxtApp();
  const toast = useToast();

  const isDeleting = ref(false);
  const error = ref<string | null>(null);

  async function deleteFlashcard(
    id: string
  ): Promise<DeleteFlashcardResult | null> {
    isDeleting.value = true;
    error.value = null;

    try {
      const response = await $api.folders.deleteFlashcard(id);

      if (response.success) {
        const reviewsDeleted = response.data?.deletedReviewsCount || 0;
        const message =
          reviewsDeleted > 0
            ? `Flashcard and ${reviewsDeleted} review record(s) deleted.`
            : "Flashcard deleted successfully.";

        toast.add({
          title: "Flashcard Deleted",
          description: message,
          color: "success",
        });
        return response.data || { success: true };
      }

      throw new Error(response.error.message || "Failed to delete flashcard");
    } catch (err: any) {
      const errorMessage =
        err?.data?.message || err?.message || "Failed to delete flashcard";
      error.value = errorMessage;

      toast.add({
        title: "Error",
        description: errorMessage,
        color: "error",
      });

      return null;
    } finally {
      isDeleting.value = false;
    }
  }

  return {
    deleteFlashcard,
    isDeleting,
    error,
  };
}

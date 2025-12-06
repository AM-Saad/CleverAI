// app/composables/flashcards/useUpdateFlashcard.ts

export interface UpdateFlashcardPayload {
  front?: string;
  back?: string;
}

export function useUpdateFlashcard() {
  const { $api } = useNuxtApp();
  const toast = useToast();

  const isUpdating = ref(false);
  const error = ref<string | null>(null);

  async function updateFlashcard(id: string, payload: UpdateFlashcardPayload) {
    isUpdating.value = true;
    error.value = null;

    try {
      const response = await $api.folders.updateFlashcard(id, payload);

      if (response.success && response.data) {
        toast.add({
          title: "Flashcard Updated",
          description: "Your flashcard has been updated successfully.",
          color: "success",
        });
        return response.data;
      }

      // Handle error case
      const errorMsg = !response.success
        ? response.error?.message
        : "Failed to update flashcard";
      throw new Error(errorMsg || "Failed to update flashcard");
    } catch (err: any) {
      const errorMessage =
        err?.data?.message || err?.message || "Failed to update flashcard";
      error.value = errorMessage;

      toast.add({
        title: "Error",
        description: errorMessage,
        color: "error",
      });

      return null;
    } finally {
      isUpdating.value = false;
    }
  }

  return {
    updateFlashcard,
    isUpdating,
    error,
  };
}

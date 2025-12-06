// app/composables/flashcards/useCreateFlashcard.ts

export interface CreateFlashcardPayload {
  folderId: string;
  front: string;
  back: string;
  materialId?: string;
}

export function useCreateFlashcard() {
  const { $api } = useNuxtApp();
  const toast = useToast();

  const isCreating = ref(false);
  const error = ref<string | null>(null);

  async function createFlashcard(payload: CreateFlashcardPayload) {
    isCreating.value = true;
    error.value = null;

    try {
      const response = await $api.folders.createFlashcard(payload);

      if (response.success && response.data) {
        toast.add({
          title: "Flashcard Created",
          description: "Your flashcard has been created successfully.",
          color: "success",
        });
        return response.data;
      }

      // Handle error case
      const errorMsg = !response.success
        ? response.error?.message
        : "Failed to create flashcard";
      throw new Error(errorMsg || "Failed to create flashcard");
    } catch (err: any) {
      const errorMessage =
        err?.data?.message || err?.message || "Failed to create flashcard";
      error.value = errorMessage;

      toast.add({
        title: "Error",
        description: errorMessage,
        color: "error",
      });

      return null;
    } finally {
      isCreating.value = false;
    }
  }

  return {
    createFlashcard,
    isCreating: readonly(isCreating),
    error: readonly(error),
  };
}

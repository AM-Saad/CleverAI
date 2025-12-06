// app/composables/flashcards/useUpdateFlashcard.ts
import type {
  Flashcard,
  UpdateFlashcardDTO,
} from "@@/shared/utils/flashcard.contract";
import { useOperation } from "../shared/useOperation";

export function useUpdateFlashcard() {
  const { $api } = useNuxtApp();
  const toast = useToast();

  const operation = useOperation<Flashcard>();

  async function updateFlashcard(id: string, payload: UpdateFlashcardDTO) {
    const result = await operation.execute(() =>
      $api.folders.updateFlashcard(id, payload)
    );

    if (result) {
      toast.add({
        title: "Flashcard Updated",
        description: "Your flashcard has been updated successfully.",
        color: "success",
      });
    } else if (operation.error.value) {
      toast.add({
        title: "Error",
        description:
          operation.error.value.message || "Failed to update flashcard",
        color: "error",
      });
    }

    return result;
  }

  return {
    updateFlashcard,
    isUpdating: operation.pending,
    error: operation.error,
  };
}

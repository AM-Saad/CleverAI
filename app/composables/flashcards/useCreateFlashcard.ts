// app/composables/flashcards/useCreateFlashcard.ts
import type {
  Flashcard,
  CreateFlashcardDTO,
} from "@@/shared/utils/flashcard.contract";
import { useOperation } from "../shared/useOperation";

export function useCreateFlashcard() {
  const { $api } = useNuxtApp();
  const toast = useToast();

  const operation = useOperation<Flashcard>();

  async function createFlashcard(payload: CreateFlashcardDTO) {
    const result = await operation.execute(() =>
      $api.folders.createFlashcard(payload)
    );

    if (result) {
      toast.add({
        title: "Flashcard Created",
        description: "Your flashcard has been created successfully.",
        color: "success",
      });
    } else if (operation.error.value) {
      toast.add({
        title: "Error",
        description:
          operation.error.value.message || "Failed to create flashcard",
        color: "error",
      });
    }

    return result;
  }

  return {
    createFlashcard,
    isCreating: operation.pending,
    error: operation.error,
  };
}

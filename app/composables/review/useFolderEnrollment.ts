import type { EnrollCardResponse } from "~/shared/utils/review.contract";

import { useOperation } from "~/composables/shared/useOperation";

export function useFolderEnrollment(
  folderId: string | Ref<string>,
  folder: Ref<Folder | null | undefined>
) {
  const { $api } = useNuxtApp();

  const enrolledFlashcardIds = ref(new Set<string>());
  const enrolledQuestionIds = ref(new Set<string>());

  // Use centralized operation handling
  const enrollmentOperation = useOperation<{ enrollments: Record<string, boolean> }>();

  // Helper to ensure we have a string ID
  const resolvedFolderId = computed(() => unref(folderId));


  // Optimization: Don't fetch if folder has no content
  const hasQuestions = computed(() => folder.value?.questions && folder.value.questions.length > 0);
  const hasFlashcards = computed(() => folder.value?.flashcards && folder.value.flashcards.length > 0);

  const fetchEnrollments = async () => {
    const fId = resolvedFolderId.value;
    const currentFolder = folder.value;

    if (!fId || !currentFolder) return;


    if (!hasQuestions.value && !hasFlashcards.value) return;

    const response = await enrollmentOperation.execute(() =>
      $api.review.getEnrollmentStatus(undefined, undefined, fId)
    );
    console.log("response", response)
    if (response) {
      const enrollments = response?.enrollments || {};
      enrolledQuestionIds.value.clear();
      enrolledFlashcardIds.value.clear();

      // Populate sets based on known IDs in the folder
      currentFolder.questions?.forEach((q) => {
        if (q.id && enrollments[q.id]) enrolledQuestionIds.value.add(q.id);
      });

      currentFolder.flashcards?.forEach((f) => {
        if (f.id && enrollments[f.id]) enrolledFlashcardIds.value.add(f.id);
      });
    }
  };

  // Auto-fetch when folder data becomes available
  watch(
    folder,
    (newVal) => {
      if (newVal) fetchEnrollments();
    },
    { immediate: true }
  );

  const onEnrolled = (response: EnrollCardResponse, type: 'question' | 'flashcard') => {
    if (response.success && response.cardId) {
      if (type === 'question') {
        enrolledQuestionIds.value.add(response.cardId);
      } else {
        enrolledFlashcardIds.value.add(response.cardId);
      }
    }
  };

  return {
    enrolledFlashcardIds,
    enrolledQuestionIds,
    fetchEnrollments,
    onEnrolled,
    loading: enrollmentOperation.pending,
    error: enrollmentOperation.error
  };
}

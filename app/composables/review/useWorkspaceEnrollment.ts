import type { EnrollCardResponse } from "~/shared/utils/review.contract";
import type { Ref } from "vue";
import type { WorkspaceStudyContent } from "@@/shared/utils/workspace.contract";

import { useOperation } from "~/composables/shared/useOperation";

export function useWorkspaceEnrollment(
  workspaceId: string | Ref<string>,
  studyContent: Ref<WorkspaceStudyContent | null | undefined>
) {
  const { $api } = useNuxtApp();

  const enrolledFlashcardIds = ref(new Set<string>());
  const enrolledQuestionIds = ref(new Set<string>());

  // Use centralized operation handling
  const enrollmentOperation = useOperation<{ enrollments: Record<string, boolean> }>();

  // Helper to ensure we have a string ID
  const resolvedWorkspaceId = computed(() => unref(workspaceId));

  // Optimization: Don't fetch if workspace has no content
  const hasQuestions = computed(() => (studyContent.value?.questions?.length ?? 0) > 0);
  const hasFlashcards = computed(() => (studyContent.value?.flashcards?.length ?? 0) > 0);

  const fetchEnrollments = async () => {
    const fId = resolvedWorkspaceId.value;
    const currentContent = studyContent.value;

    if (!fId || !currentContent) return;


    if (!hasQuestions.value && !hasFlashcards.value) {
      enrolledQuestionIds.value.clear();
      enrolledFlashcardIds.value.clear();
      return;
    }

    const response = await enrollmentOperation.execute(() =>
      $api.review.getEnrollmentStatus(undefined, undefined, fId)
    );
    console.log("response", response)
    if (response) {
      const enrollments = response?.enrollments || {};
      enrolledQuestionIds.value.clear();
      enrolledFlashcardIds.value.clear();

      // Populate sets based on known IDs in the workspace
      currentContent.questions.forEach((q) => {
        if (q.id && enrollments[q.id]) enrolledQuestionIds.value.add(q.id);
      });

      currentContent.flashcards.forEach((f) => {
        if (f.id && enrollments[f.id]) enrolledFlashcardIds.value.add(f.id);
      });
    }
  };

  // Auto-fetch when workspace data becomes available
  watch(
    studyContent,
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

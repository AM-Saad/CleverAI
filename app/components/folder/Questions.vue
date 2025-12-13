<template>
  <div class="w-full h-full overflow-auto grow">
    <shared-empty-state v-if="(!questionsToShow || questionsToShow.length === 0)"
      description="Generate questions from your materials using the Generate button on each material card." />

    <div v-if="questionsToShow?.length" class="space-y-4 overflow-auto">
      <UiCard v-for="(q, idx) in questionsToShow" :key="'id' in q ? q.id : idx" class="relative">
        <!-- Enrollment status indicator -->
        <div v-if="'id' in q && q.id && enrolledQuestions.has(q.id)" class="absolute top-2 right-2">
          <span
            class="inline-flex items-center justify-center h-5 w-5 rounded-full text-xs font-medium bg-primary border border-muted">✓</span>
        </div>

        <ui-paragraph size="sm" class="font-medium mb-2">{{ idx + 1 }}. {{ q.question }}</ui-paragraph>
        <ul class="list-disc ml-5 mb-4">
          <ui-paragraph v-for="(choice, cIdx) in q.choices" :key="cIdx"
            :color="cIdx === q.answerIndex ? 'success' : 'neutral'" tag="li">
            {{ choice }}
          </ui-paragraph>
        </ul>

        <!-- Enroll Button -->
        <div class="mt-4 pt-3 border-t border-muted dark:border-muted">
          <ReviewEnrollButton v-if="'id' in q && q.id" :resource-type="'question'" :resource-id="q.id"
            :is-enrolled="enrolledQuestions.has(q.id)" @enrolled="handleQuestionEnrolled" @error="handleEnrollError" />
          <div v-else class="text-xs text-muted">
            Save question to enable review
          </div>
        </div>
      </UiCard>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useRoute } from "vue-router";
import { computed, ref, watch } from "vue";
import type { EnrollCardResponse } from "~/shared/utils/review.contract";

const route = useRoute();
const id = route.params.id as string;

const { folder } = useFolder(id);

const existingQuestions = computed(
  () => (folder.value as Folder | null | undefined)?.questions || []
);

const questionsToShow = computed(() => existingQuestions.value);

// Track enrolled questions
const enrolledQuestions = ref(new Set<string>());

// Check enrollment status when questions are available
watch(
  questionsToShow,
  async (items) => {
    if (items && items.length > 0) {
      await checkEnrollmentStatus();
    }
  },
  { immediate: true }
);

async function checkEnrollmentStatus() {
  const questionIds =
    questionsToShow.value
      ?.filter((q) => q && typeof q === "object" && "id" in q && q.id)
      .map((q) => (q as { id: string }).id) || [];
  if (questionIds.length === 0) return;

  try {
    const { $api } = useNuxtApp();
    const response = await $api.review.getEnrollmentStatus(
      questionIds,
      "question"
    );

    // Update enrolled questions Set
    enrolledQuestions.value.clear();
    if (
      response &&
      response.success &&
      response.data &&
      response.data.enrollments &&
      typeof response.data.enrollments === "object"
    ) {
      Object.entries(response.data.enrollments).forEach(
        ([questionId, isEnrolled]) => {
          if (isEnrolled) {
            enrolledQuestions.value.add(questionId);
          }
        }
      );
    }
  } catch (error) {
    console.error("Failed to check enrollment status:", error);
  }
}

function handleQuestionEnrolled(response: EnrollCardResponse) {
  if (response.success && response.cardId) {
    checkEnrollmentStatus();
    console.log("Question enrolled successfully:", response.cardId);
  }
}

function handleEnrollError(error: string) {
  console.error("Failed to enroll question:", error);
}
</script>

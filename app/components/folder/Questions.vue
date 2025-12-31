<template>
  <div class="w-full h-full overflow-auto grow">
    <shared-empty-state v-if="(!questionsToShow || questionsToShow.length === 0)"
      description="Generate questions from your materials using the Generate button on each material card." />

    <div v-if="questionsToShow?.length" class="space-y-4 overflow-auto">
      <UiCard v-for="(q, idx) in questionsToShow" :key="'id' in q ? q.id : idx" class="relative">
        <!-- Enrollment status indicator -->
        <div v-if="'id' in q && q.id && props.enrolledIds.has(q.id)" class="absolute top-2 right-2">
          <span
            class="inline-flex items-center justify-center h-5 w-5 rounded-full text-xs font-medium bg-primary border border-muted">✓</span>
        </div>

        <ui-paragraph size="sm" class="font-medium mb-2 text-wrap pr-4">{{ idx + 1 }}. {{ q.question }}</ui-paragraph>
        <ul class="list-disc ml-5 mb-4">
          <ui-paragraph v-for="(choice, cIdx) in q.choices" :key="cIdx"
            :color="cIdx === q.answerIndex ? 'success' : 'neutral'" tag="li">
            {{ choice }}
          </ui-paragraph>
        </ul>

        <!-- Enroll Button -->
        <div class="mt-4 pt-3 border-t border-muted dark:border-muted">
          <ReviewEnrollButton v-if="'id' in q && q.id" :resource-type="'question'" :resource-id="q.id"
            :is-enrolled="props.enrolledIds.has(q.id)" @enrolled="handleQuestionEnrolled" @error="handleEnrollError" />
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
import { computed } from "vue";
import type { EnrollCardResponse } from "~/shared/utils/review.contract";

const route = useRoute();
const id = route.params.id as string;

// Props from parent
interface Props {
  enrolledIds?: Set<string>;
  isEnrollingLoading?: boolean;
}
const props = withDefaults(defineProps<Props>(), {
  enrolledIds: () => new Set(),
  isEnrollingLoading: false,
});

const emit = defineEmits<{
  (e: "enrolled", response: EnrollCardResponse): void;
}>();

const { folder } = useFolder(id);

const existingQuestions = computed(
  () => (folder.value as Folder | null | undefined)?.questions || []
);

const questionsToShow = computed(() => existingQuestions.value);

function handleQuestionEnrolled(response: EnrollCardResponse) {
  if (response.success && response.cardId) {
    emit("enrolled", response);
    console.log("Question enrolled successfully:", response.cardId);
  }
}

function handleEnrollError(error: string) {
  console.error("Failed to enroll question:", error);
}
</script>

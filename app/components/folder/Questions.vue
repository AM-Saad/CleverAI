<template>
  <div class="w-full h-full overflow-auto grow">
    <shared-empty-state v-if="(!questionsToShow || questionsToShow.length === 0)"
      description="Generate questions from your materials using the Generate button on each material card." />

    <div v-if="questionsToShow?.length" class="space-y-4 overflow-auto">
      <ui-card variant="ghost" v-for="(q, idx) in questionsToShow" :key="'id' in q ? q.id : idx"
        class="relative pb-3 border-b border-muted dark:border-muted rounded-none!" size="xs">
        <!-- Enrollment status indicator -->
        <div v-if="'id' in q && q.id && props.enrolledIds.has(q.id)"
          class="absolute top-1 right-2 inline-flex items-center justify-center h-6 w-8 rounded-full text-xs font-medium bg-primary border border-muted text-light"
          title="Enrolled in Review">
          <span>✓</span>
        </div>
        <u-collapsible class="flex flex-col min-h-0">

          <ui-paragraph size="xs" class="font-medium mb-2 text-wrap mr-12 cursor-pointer" color="neutral">
            {{ idx + 1 }}. {{ q.question }}</ui-paragraph>
          <template #content>

            <ul class="list-disc ml-3 space-y-2">
              <ui-paragraph size="xs" class="text-wrap" v-for="(choice, cIdx) in q.choices" :key="cIdx"
                :color="cIdx === q.answerIndex ? 'success' : 'muted'" tag="li">
                {{ choice }}
              </ui-paragraph>
            </ul>
            <!-- Enroll Button -->
            <div class="mt-2 pt-3" v-if="'id' in q && q.id && !props.enrolledIds.has(q.id)">
              <ReviewEnrollButton :resource-type="'question'" :resource-id="q.id"
                :is-enrolled="props.enrolledIds.has(q.id)" @enrolled="handleQuestionEnrolled"
                @error="handleEnrollError" />

            </div>
          </template>
        </u-collapsible>
      </ui-card>
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

<template>
  <div class="w-full h-full overflow-auto grow flex flex-col">
    <!-- Bulk Enroll Button -->
    <div v-if="draftQuestions.length > 0" class="mb-3 flex justify-start">
      <u-button size="sm" variant="soft" color="primary" @click="bulkEnrollDrafts" :loading="bulkEnrolling">
        <Icon name="i-lucide-check-circle" class="w-4 h-4 mr-1" />
        Enroll {{ draftQuestions.length }} Draft{{ draftQuestions.length > 1 ? 's' : '' }}
      </u-button>
    </div>

    <shared-empty-state v-if="(!questionsToShow || questionsToShow.length === 0)"
      description="Generate questions from your materials using the Generate button on each material card." />

    <div v-if="questionsToShow?.length" class="space-y-4 overflow-auto">
      <ui-card variant="ghost" v-for="(q, idx) in questionsToShow" :key="'id' in q ? q.id : idx"
        :class="['relative pb-3 border-b border-secondary  rounded-none!', { 'draft-question': q.status === 'DRAFT' }]"
        size="xs">
        <!-- Draft/Enrollment status indicators -->
        <div class="absolute top-1 right-2 flex items-center gap-2">
          <!-- Draft badge -->
          <u-badge v-if="q.status === 'DRAFT'" color="orange" variant="subtle" size="xs">
            Draft
          </u-badge>
          <!-- Enrolled badge -->
          <div v-else-if="'id' in q && q.id && props.enrolledIds.has(q.id)"
            class="inline-flex items-center justify-center h-6 w-8 rounded-full text-xs font-medium bg-primary border border-secondary text-on-primary"
            title="Enrolled in Review">
            <span>✓</span>
          </div>
          <!-- Context button -->
          <u-button v-if="q.sourceRef" size="xs" variant="ghost" @click.stop="contextBridge.locateSource(q, id)"
            title="View source context">
            <Icon name="i-lucide-external-link" class="w-3 h-3" />
          </u-button>
        </div>

        <u-collapsible class="flex flex-col min-h-0">

          <ui-paragraph size="xs" class="font-medium mb-2 text-wrap mr-12 cursor-pointer">
            {{ idx + 1 }}. {{ q.question }}</ui-paragraph>
          <template #content>

            <ul class="list-disc ml-3 space-y-2">
              <ui-paragraph size="xs" class="text-wrap" v-for="(choice, cIdx) in q.choices" :key="cIdx"
                :color="cIdx === q.answerIndex ? 'success' : 'onsurface'" tag="li">
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

<style scoped>
/* Draft question styling */
/* .draft-question {
  border-left: 3px solid rgb(251 146 60 / 0.6) !important;
  background: linear-gradient(90deg, rgb(255 247 237 / 0.3) 0%, transparent 100%);
}

.dark .draft-question {
  border-left-color: rgb(251 146 60 / 0.4) !important;
  background: linear-gradient(90deg, rgb(124 45 18 / 0.2) 0%, transparent 100%);
} */
</style>

<script setup lang="ts">
import { useRoute } from "vue-router";
import { computed, ref } from "vue";
import type { EnrollCardResponse } from "~/shared/utils/review.contract";

const route = useRoute();
const id = route.params.id as string;

// Context Bridge integration
const contextBridge = useContextBridge();

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

const { folder, refresh: refreshFolder } = useFolder(id);

const existingQuestions = computed(
  () => (folder.value as Folder | null | undefined)?.questions || []
);

const questionsToShow = computed(() => existingQuestions.value);

// Filter draft questions for bulk enrollment
const draftQuestions = computed(() =>
  questionsToShow.value.filter((q: any) => q.status === 'DRAFT')
);

const bulkEnrolling = ref(false);

async function bulkEnrollDrafts() {
  if (draftQuestions.value.length === 0) return;

  bulkEnrolling.value = true;
  const draftIds = draftQuestions.value.map((q: any) => q.id);
  const success = await contextBridge.bulkEnroll(draftIds, 'question');

  if (success) {
    await refreshFolder();
  }
  bulkEnrolling.value = false;
}

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

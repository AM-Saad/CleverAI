<template>
  <div>
    <div class="flex items-center justify-end mb-2">
      <span v-if="rateLimitRemaining !== null"
        class="inline-flex items-center text-xs px-2 py-1 rounded bg-neutral-50 dark:bg-neutral-900 border border-neutral-200/50 dark:border-neutral-700/50">
        Remaining:
        <span class="ml-1 font-medium">{{ rateLimitRemaining }}</span>
      </span>
      <!-- <UButton v-if="questionsToShow && questionsToShow?.length > 0" :loading="generating || loading"
        :disabled="generating || loading" @click="onGenerate" size="sm">
        <span v-if="!generating">Generate Questions</span>
        <span v-else>Generating…</span>
      </UButton> -->
      <u-tooltip v-if="questionsToShow && questionsToShow?.length > 0 && materialsLength === 0"
        :text="'Please add materials before generating flashcards.'" :popper="{ placement: 'top' }">
        <u-button color="primary" size="sm" :loading="false" :disabled="true">
          <icons-stars-generative />
          Generate Questions
        </u-button>
      </u-tooltip>
      <u-button v-if="questionsToShow && questionsToShow?.length > 0 && materialsLength && materialsLength > 0"
        color="primary" size="sm" :loading="generating || loading" :disabled="generating" @click="onGenerate">
        <icons-stars-generative />
        <span v-if="!generating">Generate Questions</span>
        <span v-else>Generating…</span>
      </u-button>
    </div>

    <!-- <UiParagraph
      v-if="(!questionsToShow || questionsToShow.length === 0) && !generating"
      size="xs"
      color="muted"
    >
      No questions yet.<br />
      Click “Generate Questions” to create some from this folder's content.
    </UiParagraph> -->

    <shared-empty-state v-if="(!questionsToShow || questionsToShow.length === 0) && !generating" title="No Questions"
      description="Click 'Generate Questions' to create some from this folder's content."
      button-text="Generate Questions" @action="onGenerate" :is-blocked="materialsLength === 0"
      :blocked-tooltip="materialsLength === 0 ? 'Please add materials before generating questions.' : ''" />

    <shared-error-message v-if="genError" :error="genError" class="mt-2" />

    <div v-if="questionsToShow?.length" class="mt-4 space-y-4">
      <UiCard v-for="(q, idx) in questionsToShow" :key="idx">
        <ui-paragraph size="sm">{{ idx + 1 }}. {{ q.question }}</ui-paragraph>
        <ul class="list-disc ml-5">
          <!-- <li v-for="(choice, cIdx) in q.choices" :key="cIdx"
                        :class="{ 'font-semibold text-success': cIdx === q.answerIndex }">
                        {{ choice }}
                    </li> -->
        </ul>
      </UiCard>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useRoute } from "vue-router";
import { computed } from "vue";


// Note: Using NoteState from useNotesStore instead of local interface
interface Props {
  materialsLength?: number;
}

const props = defineProps<Props>();



const route = useRoute();
const id = route.params.id as string;

const { folder, loading } = useFolder(id);

const existingQuestions = computed(
  () => (folder.value as Folder | null | undefined)?.questions || [],
);
const questionsToShow = computed(() =>
  questions.value?.length ? questions.value : existingQuestions.value,
);

const model = computed(
  () => (folder.value as Folder | null | undefined)?.llmModel,
);
const text = computed(() =>
  extractContentFromFolder(folder.value as Folder | null | undefined),
);

const { questions, generating, genError, generate, rateLimitRemaining } =
  useGenerateQuiz(
    model,
    text,
    computed(() => id),
  );

async function onGenerate() {
  if (generating || loading) return;
  await generate();
}
</script>

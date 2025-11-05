<template>
  <div class="w-full h-full min-h-fit">
    <div class="flex items-center justify-end mb-2">
      <div class="flex items-center gap-3">
        <span v-if="rateLimitRemaining !== null"
          class="inline-flex items-center text-xs px-2 py-1 rounded bg-neutral-50 dark:bg-neutral-900 border border-neutral-200/50 dark:border-neutral-700/50">
          Remaining:
          <span class="ml-1 font-medium">{{ rateLimitRemaining }}</span>
        </span>

        <u-tooltip v-if="cardsToShow && cardsToShow?.length > 0 && materialsLength === 0"
          :text="'Please add materials before generating flashcards.'" :popper="{ placement: 'top' }">
          <u-button color="primary" size="sm" :loading="false" :disabled="true">
            <icons-stars-generative />
            Generate Flashcards
          </u-button>
        </u-tooltip>
        <u-button v-if="cardsToShow && cardsToShow?.length > 0 && materialsLength && materialsLength > 0"
          color="primary" size="sm" :loading="generating || loading" :disabled="generating" @click="onGenerate">
          <icons-stars-generative />
          <span v-if="!generating">Generate Flashcards</span>
          <span v-else>Generating…</span>
        </u-button>

      </div>
    </div>
    <shared-empty-state v-if="(!cardsToShow || cardsToShow.length === 0) && !generating" title="No Flashcards"
      description="Click 'Generate Flashcards' to create some from this folder's content."
      button-text="Generate Flashcards" @action="onGenerate" :is-blocked="materialsLength === 0"
      :blocked-tooltip="materialsLength === 0 ? 'Please add materials before generating flashcards.' : ''" />

    <ui-paragraph v-if="genError" class="mt-2 text-error">
      {{ genError }}
    </ui-paragraph>

    <div v-if="cardsToShow?.length" class="mt-4 select-none h-full min-h-fit">
      <UCarousel v-slot="{ item: card }" class-names dots :items="cardsToShow" :ui="{
        item: 'select-none basis-[70%] transition-opacity [&:not(.is-snapped)]:opacity-10',
      }" class="mx-auto max-w-sm">
        <ui-flip-card class="relative">
          <template #front>
            <ui-paragraph class="w-4/5" size="sm">Q: {{ card.front }}</ui-paragraph>
            <!-- Enrollment status indicator -->
            <div v-if="'id' in card && card.id && enrolledCards.has(card.id)" class="absolute top-2 right-2">
              <span
                class="inline-flex items-center justify-center h-5 w-5 rounded-full text-xs font-medium bg-primary border border-muted">✓</span>
            </div>
          </template>
          <template #back>
            <ui-paragraph class="mb-4" size="sm">{{ card.back }}</ui-paragraph>
            <!-- Enroll Button -->
            <div class="mt-4 pt-3 border-t border-muted dark:border-muted">
              <ReviewEnrollButton v-if="'id' in card && card.id" :resource-type="'flashcard'" :resource-id="card!.id"
                :is-enrolled="enrolledCards.has(card.id)" @enrolled="handleCardEnrolled" @error="handleEnrollError" />
              <div v-else class="text-xs">Save card to enable review</div>
            </div>
          </template>
        </ui-flip-card>
      </UCarousel>
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

const model = computed(
  () => (folder.value as Folder | null | undefined)?.llmModel,
);
const text = computed(() =>
  extractContentFromFolder(folder.value as Folder | null | undefined),
);

const existingFlashcards = computed(
  () => (folder.value as Folder | null | undefined)?.flashcards || [],
);
const { flashcards, generating, genError, generate, rateLimitRemaining } =
  useGenerateFlashcards(
    model,
    text,
    computed(() => id),
  );
const cardsToShow = computed(() =>
  flashcards.value?.length ? flashcards.value : existingFlashcards.value,
);

// Track enrolled cards
const enrolledCards = ref(new Set<string>());

// Check enrollment status when cards are available
watch(
  cardsToShow,
  async (cards) => {
    if (cards && cards.length > 0) {
      await checkEnrollmentStatus();
    }
  },
  { immediate: true },
);

async function checkEnrollmentStatus() {
  const cardIds =
    cardsToShow.value
      ?.filter(
        (card) => card && typeof card === "object" && "id" in card && card.id,
      )
      .map((card) => (card as { id: string }).id) || [];
  if (cardIds.length === 0) return;

  try {
    const { $api } = useNuxtApp();
    const response = await $api.review.getEnrollmentStatus(
      cardIds,
      "flashcard",
    );

    // Update enrolled cards Set - safely check if enrollments exists
    enrolledCards.value.clear();
    if (
      response &&
      response.success &&
      response.data &&
      response.data.enrollments &&
      typeof response.data.enrollments === "object"
    ) {
      Object.entries(response.data.enrollments).forEach(
        ([cardId, isEnrolled]) => {
          if (isEnrolled) {
            enrolledCards.value.add(cardId);
          }
        },
      );
    }
  } catch (error) {
    console.error("Failed to check enrollment status:", error);
  }
}

function handleCardEnrolled(response: EnrollCardResponse) {
  if (response.success && response.cardId) {
    // The response.cardId is the CardReview ID, but we need to track by resource ID
    // Find which card was just enrolled by checking the EnrollButton's material-id prop
    // For now, we'll refetch the enrollment status to be sure
    checkEnrollmentStatus();
    console.log("Card enrolled successfully:", response.cardId);
  }
}

async function onGenerate() {
  if (generating || loading) return;
  await generate();
}

function handleEnrollError(error: string) {
  console.error("Failed to enroll card:", error);
  // You could show a toast notification here
}
</script>

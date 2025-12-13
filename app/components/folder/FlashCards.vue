<script setup lang="ts">
import { useRoute } from "vue-router";
import { computed } from "vue";
import type { Flashcard } from "@prisma/client";

const route = useRoute();
const id = route.params.id as string;

const { folder, refresh: refreshFolder } = useFolder(id);

const existingFlashcards = computed(
  () => (folder.value as Folder | null | undefined)?.flashcards || [],
);

const cardsToShow = computed(() => existingFlashcards.value);

// Track enrolled cards
const enrolledCards = ref(new Set<string>());

// Modal states
const showCreateModal = ref(false);
const showDeleteModal = ref(false);
const editingFlashcard = ref<{ id: string; front: string; back: string } | undefined>(undefined);
const deletingFlashcard = ref<{ id: string; isEnrolled: boolean } | null>(null);

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
    checkEnrollmentStatus();
    console.log("Card enrolled successfully:", response.cardId);
  }
}

function handleEnrollError(error: string) {
  console.error("Failed to enroll card:", error);
}

function handleFlashcardCreated(_flashcard: Flashcard) {
  refreshFolder();
}

function handleFlashcardUpdated(_flashcard: Flashcard) {
  refreshFolder();
  editingFlashcard.value = undefined;
}

function handleFlashcardDeleted() {
  refreshFolder();
  deletingFlashcard.value = null;
}

// Edit/Delete actions
function openEditModal(card: Flashcard) {
  editingFlashcard.value = {
    id: card.id,
    front: card.front,
    back: card.back,
  };
  showCreateModal.value = true;
}

function openDeleteModal(card: Flashcard) {
  deletingFlashcard.value = {
    id: card.id,
    isEnrolled: enrolledCards.value.has(card.id),
  };
  showDeleteModal.value = true;
}

function closeCreateModal() {
  showCreateModal.value = false;
  editingFlashcard.value = undefined;
}
</script>


<template>
  <div class="flex flex-col h-full">
    <!-- Header with Add button -->
    <div class="flex justify-end mb-2">
      <UButton size="xs" variant="soft" color="primary" @click="showCreateModal = true">
        <Icon name="i-lucide-plus" class="w-4 h-4 mr-1" />
        Add Card
      </UButton>
    </div>

    <!-- Empty state -->
    <shared-empty-state v-if="!cardsToShow || cardsToShow.length === 0" title="No Flashcards"
      description="Create flashcards manually or generate them from your materials." container-class="text-xs grow">
      <template #action>
        <UButton size="sm" color="primary" @click="showCreateModal = true">
          <Icon name="i-lucide-plus" class="w-4 h-4 mr-1" />
          Create Flashcard
        </UButton>
      </template>
    </shared-empty-state>

    <!-- Flashcards carousel -->
    <UCarousel v-if="cardsToShow?.length" v-slot="{ item: card }" dots :items="cardsToShow" :ui="{
      root: 'grow flex basis-full flex-col',
      viewport: 'grow overflow-hidden basis-full rounded-lg',
      container: 'flex grow basis-full gap-1 h-full w-full -ms-0 p-1',
      item: 'select-none transition-opacity flex grow basis-full  min-h-full h-full ps-0 overflow-hidden',
      dots: 'bottom-0 relative mt-2 flex justify-center gap-2',
    }">
      <ui-flip-card>
        <template #front>
          <ui-paragraph size="base" class="mt-4">{{ card.front }}</ui-paragraph>
          <!-- Top-right badges and actions -->
          <div class="absolute top-2 right-2 flex items-center gap-2 ">
            <!-- Enrolled badge -->
            <span v-if="'id' in card && card.id && enrolledCards.has(card.id)"
              class="inline-flex items-center justify-center h-6 w-8 rounded-full text-xs font-medium bg-primary border border-muted text-light"
              title="Enrolled in Review">✓</span>
            <div class="justify-between gap-1 bg-primary/10 rounded-full overflow-hidden">

              <!-- Edit button -->
              <UButton v-if="'id' in card && card.id" size="sm" variant="ghost" @click.stop="openEditModal(card)"
                title="Edit flashcard">
                <Icon name="i-lucide-pencil" class="w-3 h-3" />
              </UButton>
              <!-- Delete button -->
              <UButton v-if="'id' in card && card.id" size="sm" variant="ghost" color="error"
                @click.stop="openDeleteModal(card)" title="Delete flashcard">
                <Icon name="i-lucide-trash-2" class="w-3 h-3" />
              </UButton>
            </div>
          </div>
        </template>
        <template #back>
          <ui-paragraph class="basis-3/4 overflow-auto" size="xs">{{ card.back
            }}</ui-paragraph>
          <ReviewEnrollButton v-if="'id' in card && card.id" :resource-type="'flashcard'" :resource-id="card!.id"
            :is-enrolled="enrolledCards.has(card.id)" @enrolled="handleCardEnrolled" @error="handleEnrollError" />
          <div v-else class="text-xs">Save card to enable review</div>
        </template>
      </ui-flip-card>
    </UCarousel>

    <!-- Create/Edit Flashcard Modal -->
    <flashcards-create-flashcard-modal :show="showCreateModal" :folder-id="id" :flashcard="editingFlashcard"
      @close="closeCreateModal" @created="handleFlashcardCreated" @updated="handleFlashcardUpdated" />

    <!-- Delete Flashcard Modal -->
    <flashcards-delete-flashcard-modal v-if="deletingFlashcard" :show="showDeleteModal"
      :flashcard-id="deletingFlashcard.id" :is-enrolled="deletingFlashcard.isEnrolled"
      @close="showDeleteModal = false; deletingFlashcard = null" @deleted="handleFlashcardDeleted" />
  </div>
</template>

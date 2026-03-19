<script setup lang="ts">
import { useRoute } from "vue-router";
import { computed } from "vue";
import type { Flashcard } from "@prisma/client";

const route = useRoute();
const id = route.params.id as string;

const { folder, refresh: refreshFolder } = useFolder(id);

// Context Bridge integration
const contextBridge = useContextBridge();

const existingFlashcards = computed(
  () => (folder.value as Folder | null | undefined)?.flashcards || [],
);


const cardsToShow = computed(() => existingFlashcards.value);

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

// Modal states
const showCreateModal = ref(false);
const showDeleteModal = ref(false);
const editingFlashcard = ref<{ id: string; front: string; back: string } | undefined>(undefined);
const deletingFlashcard = ref<{ id: string; isEnrolled: boolean } | null>(null);


function handleCardEnrolled(response: EnrollCardResponse) {
  if (response.success && response.cardId) {
    emit("enrolled", response);
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
    isEnrolled: props.enrolledIds.has(card.id),
  };
  showDeleteModal.value = true;
}

function closeCreateModal() {
  showCreateModal.value = false;
  editingFlashcard.value = undefined;
}

onMounted(() => {
  console.log("isEnrollingLoading", props.isEnrollingLoading);
});

// Filter draft cards for bulk enrollment
const draftCards = computed(() =>
  cardsToShow.value.filter((card: any) => card.status === 'DRAFT')
);

const bulkEnrolling = ref(false);

async function bulkEnrollDrafts() {
  if (draftCards.value.length === 0) return;

  bulkEnrolling.value = true;
  const draftIds = draftCards.value.map((card: any) => card.id);
  const success = await contextBridge.bulkEnroll(draftIds, 'flashcard');

  if (success) {
    await refreshFolder();
  }
  bulkEnrolling.value = false;
}
</script>


<template>
  <div class="flex flex-col h-full">
    <!-- Header with Add button -->
    <div class="flex justify-between items-center mb-2">
      <!-- Bulk Enroll Button -->
      <u-button v-if="draftCards.length > 0" size="sm" variant="soft" color="primary" @click="bulkEnrollDrafts"
        :loading="bulkEnrolling">
        <Icon name="i-lucide-check-circle" class="w-4 h-4 mr-1" />
        Enroll {{ draftCards.length }} Draft{{ draftCards.length > 1 ? 's' : '' }}
      </u-button>
      <div v-else></div>

      <u-button v-if="cardsToShow && cardsToShow.length > 0" size="sm" variant="ghost" color="primary"
        @click="showCreateModal = true">
        <Icon name="i-lucide-plus" class="w-4 h-4 mr-1" />
        Add Card
      </u-button>
    </div>

    <!-- Empty state -->
    <shared-empty-state v-if="!cardsToShow || cardsToShow.length === 0" title="No Flashcards"
      description="Create flashcards manually or generate them from your materials." container-class="text-xs grow">
      <template #actions>
        <u-button size="sm" color="primary" @click="showCreateModal = true">
          <Icon name="i-lucide-plus" class="w-4 h-4 mr-1" />
          Create Flashcard
        </u-button>
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
      <ui-flip-card :class="card.status === 'DRAFT' ? 'draft-card' : ''">
        <template #front>
          <ui-paragraph size="base" class="mt-4">{{ card.front }}</ui-paragraph>
          <!-- Top-right badges and actions -->
          <div class="absolute top-2 right-2 flex items-center gap-2 ">
            <!-- Draft badge -->
            <u-badge v-if="card.status === 'DRAFT'" color="secondary" size="xs" class="text-xs">
              Draft
            </u-badge>
            <!-- Enrolled badge -->
            <span v-else-if="'id' in card && card.id && props.enrolledIds.has(card.id)"
              class="inline-flex items-center justify-center h-6 w-8 rounded-full text-xs font-medium bg-primary border border-muted text-on-primary"
              title="Enrolled in Review">✓</span>
            <div class="justify-between gap-1 bg-primary/10 rounded-full overflow-hidden">
              <!-- Context button -->
              <u-button v-if="card.sourceRef" size="sm" variant="ghost"
                @click.stop="contextBridge.locateSource(card, id)" title="View source context"
                :disabled="props.isEnrollingLoading">
                <Icon name="i-lucide-external-link" class="w-3 h-3" />
              </u-button>

              <!-- Edit button -->
              <u-button v-if="'id' in card && card.id" size="sm" variant="ghost" @click.stop="openEditModal(card)"
                title="Edit flashcard" :disabled="props.isEnrollingLoading">
                <Icon name="i-lucide-pencil" class="w-3 h-3 disabled:opacity-50 disabled:cursor-not-allowed" />
              </u-button>
              <!-- Delete button -->
              <u-button v-if="'id' in card && card.id" size="sm" variant="ghost" color="error"
                @click.stop="openDeleteModal(card)" title="Delete flashcard" :disabled="props.isEnrollingLoading">
                <Icon name="i-lucide-trash-2" class="w-3 h-3 disabled:opacity-50 disabled:cursor-not-allowed" />
              </u-button>
            </div>
          </div>
        </template>
        <template #back>
          <ui-paragraph class="basis-3/4 overflow-auto" size="xs">{{ card.back
            }}</ui-paragraph>
          <review-enroll-button v-if="'id' in card && card.id" :resource-type="'flashcard'" :resource-id="card!.id"
            :is-enrolled="props.enrolledIds.has(card.id)" @enrolled="handleCardEnrolled" @error="handleEnrollError" />
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

<style scoped>
/* Draft card styling */
:deep(.draft-card) {
  border: 2px dashed rgb(251 146 60 / 0.5);
  background: linear-gradient(135deg, rgb(255 247 237 / 0.3) 0%, transparent 100%);
}

.dark :deep(.draft-card) {
  border-color: rgb(251 146 60 / 0.3);
  background: linear-gradient(135deg, rgb(124 45 18 / 0.2) 0%, transparent 100%);
}
</style>

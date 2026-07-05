<script setup lang="ts">
import * as z from "zod";

interface FlashcardData {
  id: string;
  front: string;
  back: string;
}

interface Props {
  show: boolean;
  workspaceId: string;
  materialId?: string; // Optional: pre-select a material
  flashcard?: FlashcardData; // If provided, modal is in edit mode
}

const props = defineProps<Props>();
const emit = defineEmits<{
  (event: "close"): void;
  (event: "created", flashcard: any): void;
  (event: "updated", flashcard: any): void;
}>();

const { createFlashcard, isCreating } = useCreateFlashcard();
const { updateFlashcard, isUpdating } = useUpdateFlashcard();

const isEditMode = computed(() => !!props.flashcard);
const isLoading = computed(() => isCreating.value || isUpdating.value);

const state = reactive<Schema>({
  front: "",
  back: "",
})

const schema = z.object({
  front: z.string().min(1, "Front is required"),
  back: z.string().min(1, "Back is required"),
})
type Schema = z.output<typeof schema>;

// Reset/populate form when modal opens
watch(() => props.show, (isOpen) => {
  if (isOpen) {
    if (props.flashcard) {
      // Edit mode: populate with existing data
      state.front = props.flashcard.front;
      state.back = props.flashcard.back;
    } else {
      // Create mode: clear form
      state.front = "";
      state.back = "";
    }
  }
});

const isValid = computed(() => {
  return state.front.trim().length > 0 && state.back.trim().length > 0;
});

// Check if content has changed (for edit mode)
const hasChanges = computed(() => {
  if (!props.flashcard) return true;
  return (
    state.front.trim() !== props.flashcard.front ||
    state.back.trim() !== props.flashcard.back
  );
});

async function handleSubmit() {
  if (!isValid.value || isLoading.value) return;

  if (isEditMode.value && props.flashcard) {
    // Update existing flashcard
    if (!hasChanges.value) {
      emit("close");
      return;
    }

    const updated = await updateFlashcard(props.flashcard.id, {
      front: state.front.trim(),
      back: state.back.trim(),
    });

    if (updated) {
      emit("updated", updated);
      emit("close");
    }
  } else {
    // Create new flashcard
    const flashcard = await createFlashcard({
      workspaceId: props.workspaceId,
      front: state.front.trim(),
      back: state.back.trim(),
      materialId: props.materialId,
    });

    if (flashcard) {
      emit("created", flashcard);
      emit("close");
    }
  }
}

function handleClose() {
  if (!isLoading.value) {
    emit("close");
  }
}
</script>

<template>
  <shared-dialog-modal :show="show" @close="handleClose" :title="isEditMode ? 'Edit Flashcard' : 'Create Flashcard'"
    :icon="isEditMode ? 'pen' : 'pencil'">

    <template #body>
      <UiForm :schema="schema" :state="state" class="space-y-2" @submit="handleSubmit">
        <!-- Front (Question) -->
        <UiFormField label="Front" name="front">
          <ui-textarea v-model="state.front" placeholder="Enter the question or prompt..." :rows="4" autoresize
            :disabled="isLoading" class="w-full" />
        </UiFormField>

        <!-- Back (Answer) -->
        <UiFormField label="Back" name="back">
          <ui-textarea v-model="state.back" placeholder="Enter the answer or explanation..." :rows="4" autoresize
            :disabled="isLoading" class="w-full" />
        </UiFormField>
      </UiForm>
    </template>

    <template #footer>
      <div class="flex gap-3 justify-end pt-2">
        <ui-button variant="ghost" @click="handleClose" :disabled="isLoading">
          Cancel
        </ui-button>
        <ui-button color="primary" @click="handleSubmit" :loading="isLoading"
          :disabled="!isValid || isLoading || (isEditMode && !hasChanges)">
          <Icon :name="isEditMode ? 'i-lucide-check' : 'i-lucide-plus'" class="w-4 h-4 mr-1" />
          {{ isEditMode ? 'Save Changes' : 'Create Flashcard' }}
        </ui-button>
      </div>
    </template>
  </shared-dialog-modal>
</template>

<script setup lang="ts">
import type { GenerationType, MaterialGenerationState } from "~/composables/materials/useGenerateFromMaterial";

interface Props {
  show: boolean;
  generationType: GenerationType | null;
  existingCounts: MaterialGenerationState;
  loading?: boolean;
}

const props = defineProps<Props>();
const emit = defineEmits<{
  (event: "confirm"): void;
  (event: "cancel"): void;
}>();

const title = computed(() => {
  if (!props.generationType) return "Confirm Regeneration";
  return props.generationType === "flashcards"
    ? "Regenerate Flashcards?"
    : "Regenerate Questions?";
});

const itemCount = computed(() => {
  if (!props.generationType) return 0;
  return props.generationType === "flashcards"
    ? props.existingCounts.flashcardsCount
    : props.existingCounts.questionsCount;
});

const itemType = computed(() => {
  if (!props.generationType) return "items";
  return props.generationType === "flashcards" ? "flashcards" : "questions";
});
</script>

<template>
  <shared-dialog-modal :show="show" @close="$emit('cancel')">
    <template #header>
      <div class="flex items-center gap-2 text-amber-600 dark:text-amber-400">
        <icon name="mdi:alert-circle" size="20" />
        <span class="font-semibold">{{ title }}</span>
      </div>
    </template>

    <template #body>
      <div class="py-4 space-y-4">
        <!-- Warning section -->
        <div class="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
          <div class="flex items-start gap-3">
            <icon name="mdi:alert" class="text-amber-500 mt-0.5 shrink-0" size="20" />
            <div class="space-y-2">
              <p class="text-sm font-medium text-amber-800 dark:text-amber-200">
                This will permanently delete:
              </p>
              <ul class="text-sm text-amber-700 dark:text-amber-300 list-disc list-inside space-y-1">
                <li>
                  <strong>{{ itemCount }}</strong> existing {{ itemType }}
                </li>
                <li>
                  All <strong>review progress</strong> for these {{ itemType }}
                </li>
                <li>
                  Any <strong>scheduled reviews</strong> in your queue
                </li>
              </ul>
            </div>
          </div>
        </div>

        <!-- Explanation -->
        <p class="text-sm text-muted dark:text-gray-400">
          New {{ itemType }} will be generated from the material's content.
          This action cannot be undone.
        </p>

        <!-- Progress warning -->
        <div class="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3">
          <div class="flex items-center gap-2">
            <icon name="mdi:progress-clock" class="text-red-500 shrink-0" size="18" />
            <p class="text-sm font-medium text-red-700 dark:text-red-300">
              Your spaced repetition progress will be lost!
            </p>
          </div>
        </div>
      </div>
    </template>

    <template #footer>
      <div class="flex gap-3 pt-2 justify-end">
        <u-button variant="ghost" color="neutral" @click="$emit('cancel')" :disabled="loading">
          Cancel
        </u-button>
        <u-button color="warning" @click="$emit('confirm')" :loading="loading">
          <icon name="mdi:refresh" class="mr-1" size="16" />
          Regenerate
        </u-button>
      </div>
    </template>
  </shared-dialog-modal>
</template>

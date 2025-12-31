<script setup lang="ts">
import { reactive, computed } from "vue";
import * as z from "zod";
import type { FormSubmitEvent } from "@nuxt/ui";

const props = defineProps<{ show: boolean }>();
const emit = defineEmits<{
  (event: "close"): void;
  (event: "confirm", data: { confirmationText: string; permanent: boolean }): void;
}>();

const schema = z.object({
  confirmationText: z.string().refine((val) => val.trim() === "DELETE", {
    message: 'You must type "DELETE" to confirm',
  }),
  permanentDelete: z.boolean().optional(),
});

type Schema = z.output<typeof schema>;

const state = reactive<Partial<Schema>>({
  confirmationText: undefined,
  permanentDelete: false,
});

const canSubmit = computed(() => state.confirmationText?.trim() === "DELETE");

async function onSubmit(event: FormSubmitEvent<Schema>) {
  if (!canSubmit.value) return;

  emit("confirm", {
    confirmationText: state.confirmationText!,
    permanent: state.permanentDelete || false,
  });
}

const closeModal = (): void => {
  // Reset form
  state.confirmationText = undefined;
  state.permanentDelete = false;
  emit("close");
};
</script>

<template>
  <Teleport to="body">
    <shared-dialog-modal :show="props.show" @close="closeModal" title="Delete Account" icon="mdi:account-remove"
      description="This action will remove all your data">

      <template #body>
        <u-form :schema="schema" :state="state" class="space-y-4" @submit="onSubmit">
          <!-- Warning Banner -->
          <div class="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md p-4">
            <div class="flex">
              <icon name="mdi:alert-circle" class="text-red-600 dark:text-red-400 mr-3 mt-0.5" size="20"></icon>
              <div>
                <h4 class="text-sm font-medium text-red-800 dark:text-red-200 mb-1">
                  Warning: This action cannot be undone
                </h4>
                <p class="text-sm text-red-700 dark:text-red-300">
                  Deleting your account will remove all your data including folders, materials, flashcards, and
                  progress.
                </p>
              </div>
            </div>
          </div>

          <u-form-field name="confirmationText" required>
            <template #label>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Type <span class="font-bold text-red-600 dark:text-red-400">DELETE</span> to confirm
              </label>
            </template>
            <u-input v-model="state.confirmationText" placeholder="DELETE" :ui="{
              root: 'w-full',
            }" autofocus />
          </u-form-field>

          <div class="flex items-start space-x-3">
            <input v-model="state.permanentDelete" type="checkbox" id="permanent-delete"
              class="mt-1 h-4 w-4 text-red-600 focus:ring-red-500 border-gray-300 rounded cursor-pointer" />
            <div class="flex-1">
              <label for="permanent-delete" class="text-sm font-medium text-gray-700 dark:text-gray-300 cursor-pointer">
                Delete immediately and permanently
              </label>
              <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">
                <span v-if="!state.permanentDelete">
                  By default, your account will be scheduled for deletion in 30 days. You can reactivate it by signing
                  in before
                  then.
                </span>
                <span v-else class="text-red-600 dark:text-red-400 font-medium">
                  Your account will be deleted immediately and cannot be recovered.
                </span>
              </p>
            </div>
          </div>

          <div class="flex justify-end gap-3 pt-2">
            <u-button variant="soft" color="neutral" @click="closeModal" type="button">
              Cancel
            </u-button>
            <u-button color="error" type="submit" :disabled="!canSubmit">
              {{ state.permanentDelete ? "Delete Permanently" : "Schedule Deletion" }}
            </u-button>
          </div>
        </u-form>
      </template>
    </shared-dialog-modal>
  </Teleport>
</template>

<script setup lang="ts">
import { reactive, computed } from "vue";
import * as z from "zod";

const props = defineProps<{ show: boolean }>();
const emit = defineEmits<{
  (event: "close"): void;
  (
    event: "confirm",
    data: { confirmationText: string; permanent: boolean },
  ): void;
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

function onSubmit() {
  // Pressing Enter in the text field must not bypass the guarded destructive
  // button. The actual confirmation is emitted only by UiDoubleTapDeleteButton.
}

function confirmDelete() {
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
  <UiConfirmDialog
    :open="props.show"
    title="Delete Account"
    icon="delete"
    description="This action will remove all your data"
    :confirm-label="
      state.permanentDelete ? 'Delete Permanently' : 'Schedule Deletion'
    "
    :confirm-armed-label="
      state.permanentDelete
        ? 'Tap again to delete permanently'
        : 'Tap again to schedule deletion'
    "
    :confirm-disabled="!canSubmit"
    requires-double-tap
    @update:open="$event || closeModal()"
    @confirm="confirmDelete"
  >
    <UiForm
      :schema="schema"
      :state="state"
      class="space-y-4"
      @submit="onSubmit"
    >
      <!-- Warning Banner -->
      <UiPanel
        variant="subtle"
        size="md"
        role="alert"
        class-name="border-error/20 bg-error/10"
      >
        <div class="flex">
          <UiIcon
            name="i-lucide-alert-circle"
            class="text-error-text mr-3 mt-0.5"
            size="20"
          ></UiIcon>
          <div>
            <ui-title
              tag="h4"
              size="sm"
              weight="medium"
              color="error"
              class="mb-1"
            >
              Warning: This action cannot be undone
            </ui-title>
            <p class="text-sm text-error-text/80">
              Deleting your account will remove all your data including
              workspaces, materials, flashcards, and progress.
            </p>
          </div>
        </div>
      </UiPanel>

      <UiFormField name="confirmationText" required>
        <template #label>
          <label class="block text-sm font-medium text-content-on-surface">
            Type <span class="font-bold text-error-text">DELETE</span> to
            confirm
          </label>
        </template>
        <ui-input
          v-model="state.confirmationText"
          placeholder="DELETE"
          :ui="{
            root: 'w-full',
          }"
          autofocus
        />
      </UiFormField>

      <div class="flex items-start space-x-3">
        <UiCheckbox
          v-model="state.permanentDelete"
          indicator="start"
          label="Delete immediately and permanently"
        />
        <div class="flex-1">
          <p class="text-xs text-content-secondary mt-1">
            <span v-if="!state.permanentDelete">
              By default, your account will be scheduled for deletion in 30
              days. You can reactivate it by signing in before then.
            </span>
            <span v-else class="text-error-text font-medium">
              Your account will be deleted immediately and cannot be recovered.
            </span>
          </p>
        </div>
      </div>
    </UiForm>
  </UiConfirmDialog>
</template>

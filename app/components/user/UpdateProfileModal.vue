<script setup lang="ts">
import { reactive, computed, watch } from "vue";
import * as z from "zod";
import type { FormSubmitEvent } from "@nuxt/ui";
import type { UpdateProfileDTO } from "@@/shared/utils/user.contract";

interface UserProfile {
  name: string;
  gender?: string;
}

const props = defineProps<{
  show: boolean;
  currentProfile: UserProfile;
}>();

const emit = defineEmits<{
  (event: "close"): void;
  (event: "update", data: UpdateProfileDTO): void;
}>();

const schema = z.object({
  name: z.string().min(1, "Name is required"),
  gender: z.string().optional(),
});

type Schema = z.output<typeof schema>;

const state = reactive<Partial<Schema>>({
  name: undefined,
  gender: undefined,
});

const genderOptions = [
  { label: "Prefer not to say", value: "" },
  { label: "Male", value: "male" },
  { label: "Female", value: "female" },
  { label: "Other", value: "other" },
];

// Watch for changes in show prop to populate form
watch(
  () => props.show,
  (newVal) => {
    if (newVal) {
      state.name = props.currentProfile.name || "";
      state.gender = props.currentProfile.gender || "";
    }
  }
);

const hasChanges = computed(() => {
  return (
    state.name !== props.currentProfile.name ||
    state.gender !== (props.currentProfile.gender || "")
  );
});

const canSubmit = computed(() => state.name && hasChanges.value);

async function onSubmit(event: FormSubmitEvent<Schema>) {
  if (!canSubmit.value) return;

  const updates: UpdateProfileDTO = {};

  if (state.name !== props.currentProfile.name) {
    updates.name = state.name;
  }
  if (state.gender !== (props.currentProfile.gender || "")) {
    updates.gender = state.gender;
  }

  emit("update", updates);
}

const closeModal = (): void => {
  emit("close");
};
</script>

<template>
  <Teleport to="body">
    <shared-dialog-modal :show="props.show" @close="closeModal" title="Update Profile" icon="edit"
      description="Update your profile information">

      <template #body>
        <u-form :schema="schema" :state="state" class="space-y-4" @submit="onSubmit">
          <u-form-field label="Name" name="name" required>
            <ui-input v-model="state.name" placeholder="Your name" autofocus class="w-full" />
          </u-form-field>

          <u-form-field label="Gender" name="gender">
            <u-select-menu v-model="state.gender" :options="genderOptions" option-attribute="label"
              value-attribute="value" color="neutral" variant="subtle" class="w-full" />
          </u-form-field>

          <div class="flex justify-end gap-3 pt-2">
            <ui-button variant="ghost" @click="closeModal" type="button">
              Cancel
            </ui-button>
            <ui-button type="submit" :disabled="!canSubmit">
              Update Profile
            </ui-button>
          </div>
        </u-form>
      </template>
    </shared-dialog-modal>
  </Teleport>
</template>

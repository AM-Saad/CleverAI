<script setup lang="ts">
import { reactive, computed, watch } from "vue";
import * as z from "zod";
import type { FormSubmitEvent } from "@nuxt/ui";
import type { UpdateProfileDTO } from "@@/shared/utils/user.contract";

interface UserProfile {
  name: string;
  phone: string;
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
  phone: z.string().min(10, "Phone must be at least 10 characters"),
  gender: z.string().optional(),
});

type Schema = z.output<typeof schema>;

const state = reactive<Partial<Schema>>({
  name: undefined,
  phone: undefined,
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
      state.phone = props.currentProfile.phone || "";
      state.gender = props.currentProfile.gender || "";
    }
  }
);

const hasChanges = computed(() => {
  return (
    state.name !== props.currentProfile.name ||
    state.phone !== props.currentProfile.phone ||
    state.gender !== (props.currentProfile.gender || "")
  );
});

const canSubmit = computed(() => state.name && state.phone && hasChanges.value);

async function onSubmit(event: FormSubmitEvent<Schema>) {
  if (!canSubmit.value) return;

  const updates: UpdateProfileDTO = {};

  if (state.name !== props.currentProfile.name) {
    updates.name = state.name;
  }
  if (state.phone !== props.currentProfile.phone) {
    updates.phone = state.phone;
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
    <UiDialogModal :show="props.show" @close="closeModal">
      <template #header>
        <div class="flex flex-col gap-1">
          <UiSubtitle class="flex items-center gap-2">
            <icon name="mdi:account-edit" />
            Update Profile
          </UiSubtitle>
          <UiParagraph size="sm" color="muted">
            Update your profile information
          </UiParagraph>
        </div>
      </template>

      <template #body>
        <UForm :schema="schema" :state="state" class="space-y-4" @submit="onSubmit">
          <UFormField label="Name" name="name" required>
            <UInput v-model="state.name" placeholder="Your name" autofocus class="w-full" />
          </UFormField>

          <UFormField label="Phone" name="phone" required>
            <UInput v-model="state.phone" type="tel" placeholder="Your phone number" class="w-full" />
            <template #hint>
              <p class="text-xs text-gray-500 dark:text-gray-400">
                Minimum 10 characters
              </p>
            </template>
          </UFormField>

          <UFormField label="Gender" name="gender">
            <USelectMenu v-model="state.gender" :options="genderOptions" option-attribute="label"
              value-attribute="value" color="neutral" variant="subtle" class="w-full" />
          </UFormField>

          <div class="flex justify-end gap-3 pt-2">
            <UButton variant="outline" @click="closeModal" type="button">
              Cancel
            </UButton>
            <UButton type="submit" :disabled="!canSubmit">
              Update Profile
            </UButton>
          </div>
        </UForm>
      </template>
    </UiDialogModal>
  </Teleport>
</template>

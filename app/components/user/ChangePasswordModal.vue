<script setup lang="ts">
import { computed, reactive, watch } from "vue";
import type { ChangePasswordDTO } from "@@/shared/utils/user.contract";
import type { APIError } from "~/services/FetchFactory";

const props = withDefaults(
  defineProps<{
    show: boolean;
    loading?: boolean;
    error?: APIError | null;
  }>(),
  {
    loading: false,
    error: null,
  },
);

const emit = defineEmits<{
  close: [];
  change: [data: ChangePasswordDTO];
}>();

const state = reactive({
  currentPassword: "",
  newPassword: "",
  confirmPassword: "",
});

const passwordsMatch = computed(
  () => state.newPassword === state.confirmPassword,
);
const canSubmit = computed(
  () =>
    state.currentPassword.length >= 6 &&
    state.newPassword.length >= 6 &&
    state.confirmPassword.length >= 6 &&
    passwordsMatch.value &&
    !props.loading,
);

watch(
  () => props.show,
  (show) => {
    if (!show) {
      state.currentPassword = "";
      state.newPassword = "";
      state.confirmPassword = "";
    }
  },
);

function close() {
  emit("close");
}

function submit() {
  if (!canSubmit.value) return;
  emit("change", {
    currentPassword: state.currentPassword,
    newPassword: state.newPassword,
    confirmPassword: state.confirmPassword,
  });
}
</script>

<template>
  <Teleport to="body">
    <shared-dialog-modal
      :show="show"
      title="Change password"
      icon="security"
      description="Update the password used for email sign-in"
      @close="close"
    >
      <template #body>
        <form class="change-password" @submit.prevent="submit">
          <shared-error-message v-if="error" :error="error" />

          <UiInput
            v-model="state.currentPassword"
            type="password"
            autocomplete="current-password"
            placeholder="Current password"
            aria-label="Current password"
            autofocus
          />
          <UiInput
            v-model="state.newPassword"
            type="password"
            autocomplete="new-password"
            placeholder="New password"
            aria-label="New password"
          />
          <UiInput
            v-model="state.confirmPassword"
            type="password"
            autocomplete="new-password"
            placeholder="Confirm new password"
            aria-label="Confirm new password"
            :aria-invalid="
              state.confirmPassword && !passwordsMatch ? 'true' : undefined
            "
          />

          <p
            v-if="state.confirmPassword && !passwordsMatch"
            class="change-password__hint change-password__hint--error"
          >
            Passwords do not match.
          </p>
          <p v-else class="change-password__hint">
            Use at least 6 characters. You will stay signed in after updating.
          </p>

          <div class="change-password__actions">
            <UiButton
              type="button"
              variant="ghost"
              tone="neutral"
              @click="close"
            >
              Cancel
            </UiButton>
            <UiButton type="submit" :loading="loading" :disabled="!canSubmit">
              Save password
            </UiButton>
          </div>
        </form>
      </template>
    </shared-dialog-modal>
  </Teleport>
</template>

<style scoped>
.change-password {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.change-password__hint {
  font-size: 12.5px;
  color: var(--color-content-secondary);
}

.change-password__hint--error {
  color: var(--color-error);
}

.change-password__actions {
  display: flex;
  justify-content: flex-end;
  gap: var(--space-2);
  padding-top: var(--space-1);
}
</style>

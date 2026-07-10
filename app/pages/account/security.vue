<template>
  <AccountPageFrame title="Security" subtitle="Password and account deletion.">
    <UiSettingsGroup title="Sign-in">
      <UiSettingsRow
        v-if="fetchProfilePending && !profile"
        title="Loading security settings"
        description="One moment..."
      />
      <UiSettingsRow
        v-else-if="canChangePassword"
        clickable
        title="Change password"
        description="Update the password used for email sign-in"
        @click="showChangePassword = true"
      >
        <template #leading>
          <UiIcon name="i-lucide-lock-keyhole" class="h-4 w-4" />
        </template>
        <template #control>
          <UiIcon
            name="i-lucide-chevron-right"
            class="h-4 w-4 text-content-disabled"
          />
        </template>
      </UiSettingsRow>
      <UiSettingsRow
        v-else
        title="Password"
        :description="`Managed by ${authProviderLabel}`"
      >
        <template #leading>
          <UiIcon name="i-lucide-shield-check" class="h-4 w-4" />
        </template>
      </UiSettingsRow>
    </UiSettingsGroup>

    <UiSettingsGroup title="Danger zone">
      <UiSettingsRow
        title="Delete account"
        description="Schedule deletion for 30 days or delete immediately"
      >
        <template #leading>
          <UiIcon
            name="i-lucide-alert-triangle"
            class="h-4 w-4 text-error-text"
          />
        </template>
        <template #control>
          <UiButton
            size="xs"
            variant="soft"
            tone="error"
            @click="showDeleteAccount = true"
          >
            Delete
          </UiButton>
        </template>
      </UiSettingsRow>
    </UiSettingsGroup>

    <user-change-password-modal
      :show="showChangePassword"
      :loading="changePasswordPending"
      :error="changePasswordError"
      @close="showChangePassword = false"
      @change="handleChangePassword"
    />
    <user-delete-account-modal
      :show="showDeleteAccount"
      @close="showDeleteAccount = false"
      @confirm="handleDeleteAccount"
    />
  </AccountPageFrame>
</template>

<script setup lang="ts">
import { useOfflineLogout } from "~/composables/offline/useOfflineLogout";
import { computed, onMounted, ref } from "vue";
import type {
  ChangePasswordDTO,
  DeleteAccountDTO,
  UserProfile,
} from "@@/shared/utils/user.contract";

definePageMeta({ middleware: "auth" });

type ProfileWithAuth = UserProfile & {
  auth_provider?: string | null;
};

const route = useRoute();
const { data: authData, signOut } = useAuth();
const clearOfflineAccount = useOfflineLogout();
const toast = useToast();
const {
  fetchProfile,
  fetchProfilePending,
  changePassword,
  changePasswordPending,
  changePasswordError,
  deleteAccount,
} = useProfileManagement();

const profile = ref<ProfileWithAuth | null>(null);
const showChangePassword = ref(false);
const showDeleteAccount = ref(false);

const user = computed(
  () =>
    (authData.value?.user ?? {}) as {
      provider?: string;
    },
);
const authProvider = computed(
  () =>
    profile.value?.auth_provider ||
    (authData.value as { provider?: string } | null | undefined)?.provider ||
    user.value.provider ||
    "credentials",
);
const authProviderLabel = computed(() =>
  authProvider.value === "credentials"
    ? "email and password"
    : capitalizeProvider(authProvider.value),
);
const canChangePassword = computed(() => authProvider.value === "credentials");

function capitalizeProvider(provider: string) {
  return provider
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(" ");
}

async function loadProfile() {
  const result = await fetchProfile();
  if (result) profile.value = result as ProfileWithAuth;
}

async function handleChangePassword(data: ChangePasswordDTO) {
  const result = await changePassword(data);
  if (result) {
    showChangePassword.value = false;
    toast.add({ title: "Password changed", color: "success" });
  }
}

async function handleDeleteAccount(data: DeleteAccountDTO) {
  const result = await deleteAccount(data);
  if (!result) return;
  showDeleteAccount.value = false;
  await clearOfflineAccount();
  await signOut({ redirect: false });
  const target = data.permanent
    ? "/auth/signin"
    : "/auth/signin?message=account_scheduled_deletion";
  if (import.meta.client) window.location.href = target;
}

onMounted(async () => {
  await loadProfile();
  if (route.query.dialog === "password") showChangePassword.value = true;
});
</script>

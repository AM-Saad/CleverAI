<template>
  <AccountPageFrame
    title="Profile"
    subtitle="Name, email, and personal details."
  >
    <UiSettingsGroup title="Personal details">
      <UiSettingsRow
        v-if="fetchProfilePending && !profile"
        title="Loading profile"
        description="One moment..."
      />
      <UiSettingsRow
        v-else-if="profile"
        title="Personal details"
        :description="profileDescription"
        :trailing-text="
          profile.gender ? capitalize(profile.gender) : 'Not specified'
        "
      >
        <template #leading>
          <span class="account-profile__avatar">
            <img v-if="avatar" :src="avatar" :alt="name" />
            <template v-else>{{ initial }}</template>
          </span>
        </template>
        <template #control>
          <UiButton
            size="xs"
            variant="ghost"
            tone="neutral"
            :loading="fetchProfilePending"
            @click="showUpdateProfile = true"
          >
            Edit
          </UiButton>
        </template>
      </UiSettingsRow>
      <UiSettingsRow
        v-else
        title="Profile unavailable"
        description="We could not load your profile details."
      >
        <template #control>
          <UiButton
            size="xs"
            variant="soft"
            :loading="fetchProfilePending"
            @click="loadProfile"
          >
            Retry
          </UiButton>
        </template>
      </UiSettingsRow>
      <UiSettingsRow
        title="Email"
        :description="email || 'No email on this account'"
      >
        <template #leading>
          <UiIcon name="i-lucide-mail" class="h-4 w-4" />
        </template>
      </UiSettingsRow>
      <UiSettingsRow title="Member since" :description="createdAtLabel">
        <template #leading>
          <UiIcon name="i-lucide-calendar-days" class="h-4 w-4" />
        </template>
      </UiSettingsRow>
    </UiSettingsGroup>

    <user-update-profile-modal
      v-if="profile"
      :show="showUpdateProfile"
      :current-profile="{ name: profile.name, gender: profile.gender || '' }"
      @close="showUpdateProfile = false"
      @update="handleUpdateProfile"
    />
  </AccountPageFrame>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import type {
  UpdateProfileDTO,
  UserProfile,
} from "@@/shared/utils/user.contract";
import type { SubscriptionInfo } from "@shared/utils/llm-generate.contract";

definePageMeta({ middleware: "auth" });

type ProfileWithSubscription = UserProfile & {
  subscription?: SubscriptionInfo;
};

const route = useRoute();
const { data: authData } = useAuth();
const toast = useToast();
const subscriptionStore = useSubscriptionStore();
const { fetchProfile, fetchProfilePending, updateProfile, updateError } =
  useProfileManagement();

const profile = ref<ProfileWithSubscription | null>(null);
const showUpdateProfile = ref(false);

const user = computed(
  () =>
    (authData.value?.user ?? {}) as {
      name?: string;
      email?: string;
      image?: string;
    },
);
const name = computed(
  () => profile.value?.name || user.value.name || "Your account",
);
const email = computed(() => profile.value?.email || user.value.email || "");
const avatar = computed(() => user.value.image || "");
const initial = computed(() => (name.value.trim()[0] || "U").toUpperCase());
const profileDescription = computed(() =>
  email.value ? `${name.value} - ${email.value}` : name.value,
);
const createdAtLabel = computed(() =>
  profile.value?.createdAt
    ? new Date(profile.value.createdAt).toLocaleDateString(undefined, {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : "Loading account date",
);

function capitalize(value: string) {
  return value ? `${value.charAt(0).toUpperCase()}${value.slice(1)}` : value;
}

async function loadProfile() {
  const result = await fetchProfile();
  if (result) {
    profile.value = result as ProfileWithSubscription;
    subscriptionStore.updateFromData({
      subscription: (result as ProfileWithSubscription).subscription,
    });
  }
}

async function handleUpdateProfile(updates: UpdateProfileDTO) {
  const result = await updateProfile(updates);
  if (result) {
    showUpdateProfile.value = false;
    await loadProfile();
    toast.add({ title: "Profile updated", color: "success" });
  } else if (updateError.value) {
    toast.add({
      title: "Could not update profile",
      description: updateError.value.message,
      color: "error",
    });
  }
}

onMounted(async () => {
  await loadProfile();
  if (route.query.dialog === "profile") showUpdateProfile.value = true;
});
</script>

<style scoped>
.account-profile__avatar {
  display: grid;
  place-items: center;
  width: 32px;
  height: 32px;
  border-radius: var(--radius-full);
  background: var(--ds-gradient-fab);
  color: var(--color-on-primary);
  font-size: 13px;
  font-weight: 800;
  overflow: hidden;
}

.account-profile__avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
</style>

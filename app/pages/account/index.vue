<template>
  <AccountPageFrame
    id="settings"
    title="Account"
    subtitle="Profile, preferences, reminders, and security."
    back-to="/"
    back-label="Back home"
  >
    <template #action>
      <UiPill
        v-if="unreadCount > 0"
        size="sm"
        :label="String(unreadCount)"
        color="var(--color-primary)"
        variant="fill"
        max-width="60px"
      />
    </template>

    <section class="account-hub__profile" aria-label="Account summary">
      <span class="account-hub__avatar">
        <img v-if="avatar" :src="avatar" :alt="name" />
        <template v-else>{{ initial }}</template>
      </span>
      <div class="account-hub__profile-main">
        <ui-title tag="h2" class="account-hub__name">{{ name }}</ui-title>
        <p class="account-hub__email">
          {{ email || "No email on this account" }}
        </p>
      </div>
    </section>

    <nav aria-label="Account sections" class="account-hub__list">
      <UiListCard
        v-for="item in accountItems"
        :key="item.to"
        clickable
        :title="item.title"
        :description="item.description"
        :trailing-text="item.trailing"
        size="lg"
        @click="openAccountSection(item.to)"
      >
        <template #leading>
          <UiIcon :name="item.icon" class="h-5 w-5" />
        </template>
        <template #action>
          <UiIcon
            name="i-lucide-chevron-right"
            class="h-4 w-4 text-content-disabled"
          />
        </template>
      </UiListCard>
    </nav>

    <UiButton
      pill
      block
      tone="error"
      variant="soft"
      size="lg"
      :loading="signingOut"
      class="account-hub__logout"
      @click="logout"
    >
      Log out
    </UiButton>
  </AccountPageFrame>
</template>

<script setup lang="ts">
import { useOfflineLogout } from "~/composables/offline/useOfflineLogout";
import { computed, onMounted, ref } from "vue";
import type { UserProfile } from "@@/shared/utils/user.contract";
import type { SubscriptionInfo } from "@shared/utils/llm-generate.contract";

definePageMeta({ middleware: "auth" });

type ProfileWithSubscription = UserProfile & {
  subscription?: SubscriptionInfo;
};

const { data: authData, signOut } = useAuth();
const clearOfflineAccount = useOfflineLogout();
const creditsStore = useCreditsStore();
const subscriptionStore = useSubscriptionStore();
const { unreadCount } = useInAppNotifications();
const { fetchProfile } = useProfileManagement();

const signingOut = ref(false);
const profile = ref<ProfileWithSubscription | null>(null);

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
const balance = computed(() => creditsStore.balance ?? 0);
const subscriptionInfo = computed(
  () => subscriptionStore.subscriptionInfo.value,
);

const accountItems = computed(() => [
  {
    title: "Profile",
    description: "Name, email, and personal details",
    trailing: profile.value?.gender
      ? capitalize(profile.value.gender)
      : "Details",
    icon: "i-lucide-user",
    to: "/account/profile",
  },
  {
    title: "Appearance",
    description: "Theme and display preference",
    trailing: "Theme",
    icon: "i-lucide-sun-moon",
    to: "/account/appearance",
  },
  {
    title: "Plan & usage",
    description: `${balance.value} credits available`,
    trailing: subscriptionInfo.value.tier,
    icon: "i-lucide-wallet",
    to: "/account/plan",
  },
  {
    title: "Reminders",
    description: "Browser delivery and study notification timing",
    trailing:
      unreadCount.value > 0 ? `${unreadCount.value} unread` : "Settings",
    icon: "i-lucide-bell",
    to: "/account/notifications",
  },
  {
    title: "Language",
    description: "Quick capture, translation, and session defaults",
    trailing: "Learning",
    icon: "i-lucide-languages",
    to: "/account/language",
  },
  {
    title: "Offline sync",
    description: "Downloads, pending changes, and conflict resolution",
    trailing: "Manage",
    icon: "i-lucide-cloud-off",
    to: "/account/offline",
  },
  {
    title: "Security",
    description: "Password and account deletion",
    trailing: "Account",
    icon: "i-lucide-shield-check",
    to: "/account/security",
  },
  {
    title: "Data & privacy",
    description: "Export, import, and privacy controls",
    trailing: "Coming soon",
    icon: "i-lucide-database",
    to: "/account/data",
  },
  {
    title: "About",
    description: "Product information and pricing",
    trailing: "Info",
    icon: "i-lucide-info",
    to: "/account/about",
  },
]);

function capitalize(value: string) {
  return value ? `${value.charAt(0).toUpperCase()}${value.slice(1)}` : value;
}

function openAccountSection(path: string) {
  navigateTo(path);
}

async function logout() {
  signingOut.value = true;
  try {
    await clearOfflineAccount();
    await signOut({ redirect: false });
  } catch {
    /* fall through to hard redirect */
  } finally {
    if (import.meta.client) window.location.href = "/logout";
  }
}

async function loadSummary() {
  const result = await fetchProfile();
  if (result) {
    profile.value = result as ProfileWithSubscription;
    subscriptionStore.updateFromData({
      subscription: (result as ProfileWithSubscription).subscription,
    });
  }
}

onMounted(async () => {
  await Promise.all([
    loadSummary(),
    creditsStore.fetchBalance(),
    subscriptionStore.fetchSubscriptionStatus(),
  ]);
});
</script>

<style scoped>
.account-hub__profile {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-4);
  border: 1px solid var(--color-secondary);
  border-radius: var(--radius-2xl);
  background: var(--ds-surface-card);
  box-shadow: var(--shadow-card);
}

.account-hub__avatar {
  display: grid;
  place-items: center;
  width: 52px;
  height: 52px;
  border-radius: var(--radius-full);
  background: var(--ds-gradient-fab);
  color: var(--color-on-primary);
  font-size: 18px;
  font-weight: 800;
  overflow: hidden;
}

.account-hub__avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.account-hub__profile-main {
  min-width: 0;
}

.account-hub__name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 18px;
  font-weight: 800;
  color: var(--color-content-on-surface-strong);
}

.account-hub__email {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 13px;
  color: var(--color-content-secondary);
}

.account-hub__list {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.account-hub__logout {
  margin-top: var(--space-2);
}
</style>

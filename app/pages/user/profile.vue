<template>
  <shared-page-wrapper title="My Profile" subtitle="View and manage your profile information">

    <div v-if="status === 'authenticated'" class="grid md:grid-cols-3 gap-8 mt-4 max-w-full overflow-x-hidden">
      <!-- User Profile Card -->
      <div class="md:col-span-1">
        <ui-card variant="default">
          <div class="flex items-start gap-4">
            <div class="w-10 h-10 rounded-full bg-primary flex items-center justify-center text-white text-xl mb-2">
              {{ userInitials }}
            </div>
            <div>

              <ui-subtitle>
                {{ profileData?.name || "User" }}
              </ui-subtitle>
              <ui-paragraph>
                {{ profileData?.email || "...." }}
              </ui-paragraph>
            </div>
          </div>

          <div class="border-t border-muted pt-4 mt-1">
            <ui-label class="flex justify-between py-1.5">
              <span>Account Created:</span>
              <span>{{ formattedCreatedDate }}</span>
            </ui-label>
            <ui-label class="flex justify-between py-1.5">
              <span>Phone:</span>
              <span>{{ profileData?.phone || "Not provided" }}</span>
            </ui-label>
            <ui-label class="flex justify-between py-1.5">
              <span>Gender:</span>
              <span class="capitalize">{{
                profileData?.gender || "Not specified"
                }}</span>
            </ui-label>
          </div>

        </ui-card>
        <ui-card variant="default" class-name="mt-1.5">
          <ui-subtitle>Account Settings</ui-subtitle>

          <div class="flex flex-wrap gap-4 mt-4">
            <u-button size="sm" variant="subtle" @click="navigateToChangePassword">
              Change Password
            </u-button>

            <u-button size="sm" variant="subtle" color="primary" @click="navigateToSettings">
              Update Profile
            </u-button>
          </div>
        </ui-card>

        <!-- Push Notification Settings -->
        <ui-card variant="default" class-name="mt-1.5">
          <ui-subtitle>Push Notifications</ui-subtitle>
          <div class="mt-4">
            <div v-if="notificationsLoading" class="text-sm text-gray-500">
              Checking status...
            </div>
            <div v-else-if="isNotificationSubscribed" class="flex items-center justify-between">
              <span class="text-sm text-green-600 dark:text-green-400">✓ Notifications enabled</span>
              <u-button size="sm" variant="subtle" color="error" @click="handleUnsubscribe"
                :loading="notificationsLoading">
                Disable
              </u-button>
            </div>
            <div v-else class="flex items-center justify-between">
              <span class="text-sm text-gray-500">Notifications are disabled</span>
              <u-button size="sm" variant="subtle" color="primary" @click="handleResubscribe"
                :loading="notificationsLoading">
                Enable Notifications
              </u-button>
            </div>
            <p v-if="notificationError" class="text-sm text-red-500 mt-2">{{ notificationError }}</p>
          </div>
        </ui-card>
      </div>

      <!-- Subscription Information -->
      <div class="md:col-span-2 space-y-4">
        <ui-card variant="default" size="lg">
          <template #header>Subscription</template>

          <div class="mb-6">
            <div class="flex items-center justify-between">
              <ui-label>Current Plan:</ui-label>
              <span :class="{
                'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300':
                  subscriptionInfo.tier === 'PRO',
                'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300':
                  subscriptionInfo.tier === 'FREE',
                'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300':
                  subscriptionInfo.tier === 'ENTERPRISE',
              }" class="px-3 py-1 rounded-full text-xs font-semibold">
                {{ subscriptionInfo.tier }}
              </span>
            </div>

            <div v-if="subscriptionInfo.tier === 'FREE'" class="mt-2">
              <u-button size="xl" class="w-full text-center justify-center" variant="subtle" @click="navigateToUpgrade">
                Upgrade to Pro</u-button>
            </div>
          </div>

          <!-- Usage Stats -->
          <div class="mt-6">
            <ui-subtitle>Usage This Period</ui-subtitle>

            <ui-paragraph class="mb-2 flex justify-between">
              <span>AI Generations</span>
              <span>{{ subscriptionInfo.generationsUsed }} /
                {{ subscriptionInfo.generationsQuota }}</span>
            </ui-paragraph>

            <div class="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5">
              <div class="h-2.5 rounded-full bg-primary" :style="{ width: `${usagePercentage}%` }"
                :class="{ 'bg-red-500': usagePercentage > 90 }" />
            </div>

            <p class="text-sm mt-2 text-gray-500 dark:text-gray-400">
              <span v-if="subscriptionInfo.remaining > 0">
                {{ subscriptionInfo.remaining }} generations remaining
              </span>
              <span v-else class="text-red-500"> Quota exceeded </span>
            </p>
          </div>
        </ui-card>


      </div>

      <!-- LLM Usage Statistics -->
      <user-usage-statistics />
    </div>

    <!-- Loading or Unauthenticated State -->
    <div v-else-if="status === 'loading'" class="flex justify-center items-center min-h-[400px]">
      <div class="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary" />
    </div>

    <div v-else class="flex flex-col items-center justify-center min-h-[400px]">
      <p class="text-xl mb-4">Please sign in to view your profile</p>
      <u-button @click="navigateToLogin">
        Sign In
      </u-button>
    </div>


  </shared-page-wrapper>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import UiParagraph from "~/components/ui/UiParagraph.vue";
import { useSubscriptionStore } from "~/composables/shared/useSubscription";
import { useProfileManagement } from "~/composables/user/useProfileManagement";
import { useNotifications } from "~/composables/shared/useNotifications";
import type { DeleteAccountDTO, ChangePasswordDTO } from "@@/shared/utils/user.contract";

interface UserProfile {
  id: string;
  name: string;
  email: string;
  phone: string;
  gender?: string;
  role: string;
  createdAt: string;
  updatedAt: string;
  subscription: SubscriptionInfo;
}

// Use auth composable to get user data
const { status, data, signOut } = useAuth();
const router = useRouter();

// Get subscription info
const { subscriptionInfo, updateFromData } = useSubscriptionStore();

// Profile management composable
const {
  deleteAccount,
  deletePending,
  deleteError,
  changePassword,
  changePasswordPending,
  changePasswordError,
} = useProfileManagement();

// Push Notifications
const {
  isSubscribed: isNotificationSubscribed,
  isLoading: notificationsLoading,
  error: notificationError,
  registerNotification,
  unsubscribe,
  checkSubscriptionStatus,
  refreshSubscription,
} = useNotifications();
const toast = useToast();

// Create profile data ref
const profileData = ref<UserProfile | null>(null);
const isProfileLoading = ref(false);
const profileError = ref<string | null>(null);

// Modal states
const showChangePasswordModal = ref(false);
const showDeleteModal = ref(false);

// Calculate user initials for avatar
const userInitials = computed(() => {
  const name = profileData.value?.name || data.value?.user?.name || "";
  return name
    .split(" ")
    .map((part) => part.charAt(0).toUpperCase())
    .slice(0, 2)
    .join("");
});

// Format creation date
const formattedCreatedDate = computed(() => {
  if (profileData.value?.createdAt) {
    return new Date(profileData.value.createdAt).toLocaleDateString();
  }
  return "N/A";
});

// Calculate usage percentage for the progress bar
const usagePercentage = computed(() => {
  const { generationsUsed, generationsQuota } = subscriptionInfo.value;
  if (generationsQuota === 0) return 0;
  const percentage = (generationsUsed / generationsQuota) * 100;
  return Math.min(percentage, 100); // Cap at 100%
});

// Navigation functions
const navigateToLogin = () => {
  router.push("/auth/signIn");
};

const navigateToUpgrade = () => {
  router.push("/pricing");
};

const navigateToSettings = () => {
  router.push("/user/settings?action=update-profile");
};
const navigateToChangePassword = () => {
  router.push("/user/settings?action=change-password");
};


// Fetch profile data
const fetchProfile = async () => {
  if (status.value === "authenticated") {
    isProfileLoading.value = true;
    profileError.value = null;

    try {
      const response = await $fetch<UserProfile>("/api/user/profile", {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      });

      // Update profile data
      profileData.value = response;

      // Update subscription info
      if (response.subscription) {
        updateFromData({ subscription: response.subscription });
      }
    } catch (err: unknown) {
      console.error("Error fetching user profile:", err);
      if (
        err &&
        typeof err === "object" &&
        "data" in err &&
        err.data &&
        typeof err.data === "object" &&
        "message" in err.data &&
        typeof err.data.message === "string"
      ) {
        profileError.value = err.data.message;
      } else {
        profileError.value = "Failed to load profile data";
      }
    } finally {
      isProfileLoading.value = false;
    }
  }
};

// Fetch user profile and LLM usage data on component mount
onMounted(async () => {
  await fetchProfile();
  await checkSubscriptionStatus();
});

// Notification handlers
const handleUnsubscribe = async () => {
  await unsubscribe();
  if (!notificationError.value) {
    toast.add({ title: "Notifications disabled", color: "success" });
  } else {
    toast.add({ title: "Failed to disable notifications", description: notificationError.value, color: "error" });
  }
};

const handleResubscribe = async () => {
  await refreshSubscription();
  if (!notificationError.value) {
    toast.add({ title: "Notifications enabled!", color: "success" });
  } else {
    toast.add({ title: "Failed to enable notifications", description: notificationError.value, color: "error" });
  }
};
</script>

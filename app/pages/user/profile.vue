<template>
  <div class="">
    <UiTitle tag="h1">My Profile</UiTitle>

    <div
      v-if="status === 'authenticated'"
      class="grid md:grid-cols-3 gap-8 mt-4"
    >
      <!-- User Profile Card -->
      <div class="md:col-span-1">
        <UiCard variant="outline">
          <div class="flex flex-col items-center mb-4">
            <div
              class="w-24 h-24 rounded-full bg-primary flex items-center justify-center text-white text-2xl mb-4"
            >
              {{ userInitials }}
            </div>
            <UiTitle>
              {{ profileData?.name || "User" }}
            </UiTitle>
            <UiParagraph>
              {{ profileData?.email }}
            </UiParagraph>
          </div>

          <div class="border-t dark:border-gray-700 pt-4 mt-4">
            <UiParagraph class="flex justify-between py-2">
              <span> Account Created </span>
              <span>{{ formattedCreatedDate }}</span>
            </UiParagraph>
            <UiParagraph class="flex justify-between py-2">
              <span>Phone</span>
              <span>{{ profileData?.phone || "Not provided" }}</span>
            </UiParagraph>
            <UiParagraph class="flex justify-between py-2">
              <span>Gender</span>
              <span class="capitalize">{{
                profileData?.gender || "Not specified"
              }}</span>
            </UiParagraph>
          </div>
        </UiCard>
      </div>

      <!-- Subscription Information -->
      <div class="md:col-span-2 space-y-4">
        <UiCard variant="outline">
          <UiSubtitle>Subscription</UiSubtitle>

          <div class="mb-6">
            <div class="flex items-center justify-between mb-2">
              <UiParagraph> Current Plan </UiParagraph>
              <span
                :class="{
                  'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300':
                    subscriptionInfo.tier === 'PRO',
                  'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300':
                    subscriptionInfo.tier === 'FREE',
                  'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300':
                    subscriptionInfo.tier === 'ENTERPRISE',
                }"
                class="px-3 py-1 rounded-full text-xs font-semibold"
              >
                {{ subscriptionInfo.tier }}
              </span>
            </div>

            <div v-if="subscriptionInfo.tier === 'FREE'" class="mt-4">
              <UButton
                size="xl"
                class="w-full text-center justify-center"
                variant="subtle"
                @click="navigateToUpgrade"
                >Upgrade to Pro</UButton
              >
            </div>
          </div>

          <!-- Usage Stats -->
          <div class="mt-6">
            <UiSubtitle> Usage This Period </UiSubtitle>

            <div class="mb-2 flex justify-between">
              <span class="text-gray-600 dark:text-gray-400"
                >AI Generations</span
              >
              <span
                >{{ subscriptionInfo.generationsUsed }} /
                {{ subscriptionInfo.generationsQuota }}</span
              >
            </div>

            <div class="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5">
              <div
                class="h-2.5 rounded-full bg-primary"
                :style="{ width: `${usagePercentage}%` }"
                :class="{ 'bg-red-500': usagePercentage > 90 }"
              />
            </div>

            <p class="text-sm mt-2 text-gray-500 dark:text-gray-400">
              <span v-if="subscriptionInfo.remaining > 0">
                {{ subscriptionInfo.remaining }} generations remaining
              </span>
              <span v-else class="text-red-500"> Quota exceeded </span>
            </p>
          </div>
        </UiCard>

        <!-- Account Settings -->
        <UiCard variant="outline">
          <UiSubtitle>Account Settings</UiSubtitle>

          <div class="flex flex-wrap gap-4 mt-4">
            <UButton size="sm" variant="outline"> Change Password </UButton>

            <UButton size="sm" variant="outline" color="primary">
              Update Profile
            </UButton>

            <UButton size="sm" variant="outline" color="secondary">
              Notification Settings
            </UButton>

            <UButton size="sm" variant="outline" color="error">
              Delete Account
            </UButton>
          </div>
        </UiCard>
      </div>

      <!-- LLM Usage Statistics -->
      <user-usage-statistics />
    </div>

    <!-- Loading or Unauthenticated State -->
    <div
      v-else-if="status === 'loading'"
      class="flex justify-center items-center min-h-[400px]"
    >
      <div
        class="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"
      />
    </div>

    <div v-else class="flex flex-col items-center justify-center min-h-[400px]">
      <p class="text-xl mb-4">Please sign in to view your profile</p>
      <button class="btn bg-primary text-white" @click="navigateToLogin">
        Sign In
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import UiParagraph from "~/components/ui/UiParagraph.vue";
import { useSubscription } from "~/composables/shared/useSubscription";

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
const { status, data } = useAuth();
const router = useRouter();

// Get subscription info
const { subscriptionInfo } = useSubscription();

// Create profile data ref
const profileData = ref<UserProfile | null>(null);
const isProfileLoading = ref(false);
const profileError = ref<string | null>(null);

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
  router.push("/upgrade");
};

// Fetch user profile and LLM usage data on component mount
onMounted(async () => {
  if (status.value === "authenticated") {
    // Fetch profile data
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
        subscriptionInfo.value = response.subscription;
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
});
</script>

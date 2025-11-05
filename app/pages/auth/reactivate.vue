<template>
  <div class="flex items-center justify-center min-h-screen bg-gray-50 dark:bg-gray-900">
    <div class="w-full max-w-md p-8 bg-white dark:bg-gray-800 rounded-lg shadow-lg">
      <div class="text-center mb-6">
        <icon name="mdi:account-reactivate" class="text-primary mx-auto mb-4" size="64"></icon>
        <h1 class="text-2xl font-bold text-gray-900 dark:text-gray-100">
          Reactivate Your Account
        </h1>
        <p class="text-gray-600 dark:text-gray-400 mt-2">
          Your account is scheduled for deletion. Reactivate it to continue using our services.
        </p>
      </div>

      <!-- Success message -->
      <div v-if="successMessage"
        class="mb-4 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-md">
        <div class="flex items-start">
          <icon name="mdi:check-circle" class="text-green-600 dark:text-green-400 mr-3 mt-0.5" size="20"></icon>
          <div>
            <p class="text-sm text-green-800 dark:text-green-200">
              {{ successMessage }}
            </p>
            <p class="text-sm text-green-700 dark:text-green-300 mt-2">
              <NuxtLink to="/auth/signIn" class="font-semibold underline">
                Click here to sign in
              </NuxtLink>
            </p>
          </div>
        </div>
      </div>

      <!-- Error message -->
      <div v-if="errorMessage"
        class="mb-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md">
        <div class="flex items-start">
          <icon name="mdi:alert-circle" class="text-red-600 dark:text-red-400 mr-3 mt-0.5" size="20"></icon>
          <p class="text-sm text-red-800 dark:text-red-200">
            {{ errorMessage }}
          </p>
        </div>
      </div>

      <!-- Loading state -->
      <div v-if="loading" class="flex justify-center py-8">
        <div class="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary" />
      </div>

      <!-- Reactivation button -->
      <div v-else-if="!successMessage" class="space-y-4">
        <p class="text-sm text-gray-600 dark:text-gray-400">
          Click the button below to reactivate your account and restore access to all your data.
        </p>
        <UButton color="primary" class="w-full justify-center" :disabled="pending" @click="handleReactivate">
          {{ pending ? "Reactivating..." : "Reactivate Account" }}
        </UButton>

        <div class="text-center">
          <NuxtLink to="/auth/signIn" class="text-sm text-primary hover:underline">
            Back to Sign In
          </NuxtLink>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from "vue";
import { useProfileManagement } from "~/composables/user/useProfileManagement";

const route = useRoute();
const router = useRouter();

const {
  reactivateAccount,
  reactivatePending: pending,
  reactivateError: error,
} = useProfileManagement();

const successMessage = ref("");
const errorMessage = ref("");
const loading = ref(false);

// Handle account reactivation
const handleReactivate = async () => {
  errorMessage.value = "";
  successMessage.value = "";

  const result = await reactivateAccount();

  if (result) {
    successMessage.value = "Your account has been successfully reactivated!";
  } else if (error.value) {
    errorMessage.value = error.value.message || "Failed to reactivate account. Please try again.";
  }
};

// Auto-trigger reactivation if user comes from sign-in flow
onMounted(() => {
  const email = route.query.email as string | undefined;
  
  if (email) {
    // User was redirected from sign-in, show info
    errorMessage.value = "";
  }
});
</script>

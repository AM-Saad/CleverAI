<template>
  <div class="flex items-center justify-center min-h-screen bg-background">
    <UiPanel variant="surface" size="lg" class-name="w-full max-w-md rounded-[var(--radius-2xl)] shadow-[var(--shadow-card-hover)]">
      <div class="text-center mb-6">
        <icon name="mdi:account-reactivate" class="text-primary mx-auto mb-4" size="64"></icon>
        <h1 class="text-2xl font-bold text-content-on-surface-strong">
          Reactivate Your Account
        </h1>
        <p class="text-content-secondary mt-2">
          Your account is scheduled for deletion. Reactivate it to continue using our services.
        </p>
      </div>

      <!-- Success message -->
      <UiPanel v-if="successMessage" variant="subtle" size="md" class-name="mb-4 border-success/20 bg-success/10">
        <div class="flex items-start">
          <icon name="mdi:check-circle" class="text-success-text mr-3 mt-0.5" size="20"></icon>
          <div>
            <p class="text-sm text-success-text">
              {{ successMessage }}
            </p>
            <p class="text-sm text-success-text/80 mt-2">
              <NuxtLink to="/auth/signIn" class="font-semibold underline">
                Click here to sign in
              </NuxtLink>
            </p>
          </div>
        </div>
      </UiPanel>

      <!-- Error message -->
      <UiPanel v-if="errorMessage" variant="subtle" size="md" role="alert" class-name="mb-4 border-error/20 bg-error/10">
        <div class="flex items-start">
          <icon name="mdi:alert-circle" class="text-error-text mr-3 mt-0.5" size="20"></icon>
          <p class="text-sm text-error-text">
            {{ errorMessage }}
          </p>
        </div>
      </UiPanel>

      <!-- Loading state -->
      <div v-if="loading" class="flex justify-center py-8">
        <div class="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary" />
      </div>

      <!-- Reactivation button -->
      <div v-else-if="!successMessage" class="space-y-4">
        <p class="text-sm text-content-secondary">
          Click the button below to reactivate your account and restore access to all your data.
        </p>
        <UiButton color="primary" class="w-full justify-center" :disabled="pending" @click="handleReactivate">
          {{ pending ? "Reactivating..." : "Reactivate Account" }}
        </UiButton>

        <div class="text-center">
          <NuxtLink to="/auth/signIn" class="text-sm text-primary hover:underline">
            Back to Sign In
          </NuxtLink>
        </div>
      </div>
    </UiPanel>
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

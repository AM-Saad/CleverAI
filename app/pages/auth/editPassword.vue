<script setup lang="ts">
import { usePasswordResetVerification } from "@/composables/auth/usePasswordResetVerification";

// Remember to disable the middleware protection from your page!
definePageMeta({
  auth: { unauthenticatedOnly: true, navigateAuthenticatedTo: "/" },
});

const route = useRoute();
// Check if we are creating a new password or resetting an existing one
const createNewPassword = ref(route.query.newPassword);

const {
  credentials,
  emailSent,
  countDown,
  remainingAttempts,
  verified,
  token,
  loading,
  error,
  success,
  canResend,
  inlineHintVisible,
  progressPercent,
  sendResetEmail,
  verifyResetCode,
} = usePasswordResetVerification("reset-throttle");

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const isValidEmail = computed(() => {
  return EMAIL_PATTERN.test((credentials.value.email ?? "").trim());
});

const isVerificationCodeReady = computed(() => {
  return Boolean(credentials.value.verification?.trim());
});

const canSubmitCurrentStep = computed(() => {
  return emailSent.value ? isVerificationCodeReady.value : isValidEmail.value;
});

const submitLabel = computed(() => {
  return emailSent.value ? "Verify reset code" : "Send reset code";
});

/**
 * Handle form submission
 * - If email not sent yet: send reset email
 * - If email sent: verify the code
 */
const submitForm = async (): Promise<void> => {
  if (!canSubmitCurrentStep.value || loading.value) return;

  if (!emailSent.value) {
    await sendResetEmail();
  } else {
    await verifyResetCode();
  }
};
</script>

<template>
  <div>
    <div
      v-if="!verified"
      class="mx-auto mt-8 flex w-full max-w-2xl flex-col items-center justify-center"
    >
      <form
        ref="forgetpassword"
        method="post"
        class="form w-full focus:bg-surface-subtle"
        autocomplete="on"
        @submit.prevent="submitForm"
      >
        <UiTitle>
          {{ createNewPassword ? "Create" : "Reset" }} Password</UiTitle
        >
        <UiParagraph size="sm" color="content-secondary">
          Enter your email to receive a verification code
        </UiParagraph>
        <shared-error-message v-if="error" :error="error" />
        <shared-success-message v-if="success" :message="success" />

        <AuthStepFieldStack
          class="mb-2 mt-2 text-xs"
          :reveal="emailSent"
          :first-complete="emailSent || isValidEmail"
          :loading="loading"
          :submit-disabled="!canSubmitCurrentStep"
          :submit-label="submitLabel"
          :status-visible="emailSent"
          :progress-visible="emailSent && countDown > 0"
          :progress="progressPercent"
          progress-label="Reset code resend cooldown"
        >
          <template #first>
            <ui-input-field
              id="verify-email-client"
              v-model="credentials.email!"
              type="email"
              name="email"
              label="Email Address"
              title="Please enter your email address"
              autocomplete="email"
              tabindex="2"
              :styles="{
                input: 'pr-12',
                inputField: emailSent
                  ? 'rounded-b-none border-b border-secondary'
                  : '',
              }"
            />
          </template>

          <template #second>
            <ui-input-field
              id="verify-code-client"
              v-model="credentials.verification!"
              type="text"
              name="verification"
              label="Verification Code"
              title="Please enter the verification code"
              autocomplete="one-time-code"
              inputmode="numeric"
              tabindex="2"
              :styles="{
                input: 'pr-12',
                inputField: 'rounded-t-none',
              }"
            />
          </template>

          <template #status>
            <span v-if="remainingAttempts !== null">
              Attempts left: {{ remainingAttempts }}.
            </span>
            <span v-if="countDown > 0">Resend in: {{ countDown }}s</span>
            <UiButton
              v-else
              variant="link"
              size="xs"
              type="button"
              :disabled="!canResend"
              @click.prevent="sendResetEmail"
            >
              Resend Code
            </UiButton>
            <span v-if="inlineHintVisible" class="text-error-text">
              Resend limit reached. Please wait for cooldown.
            </span>
          </template>
        </AuthStepFieldStack>
      </form>
    </div>
    <auth-create-password v-else :token="token" />
    <auth-resend-blocked-toast
      :seconds="countDown"
      :attempts="remainingAttempts"
    />
  </div>
</template>

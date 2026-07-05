<script setup lang="ts">
import { useEmailVerification } from "@/composables/auth/useEmailVerification";

// Remember to disable the middleware protection from your page!
definePageMeta({
  auth: false,
});
const route = useRoute();

const {
  credentials,
  emailSent,
  resendCountDown,
  remainingAttempts,
  loading,
  error,
  success,
  canResend,
  inlineHintVisible,
  progressPercent,
  handleSendEmail,
  submitForm: submitVerificationForm,
} = useEmailVerification("verify-throttle");

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
  return emailSent.value ? "Verify account code" : "Send verification code";
});

const submitForm = async () => {
  if (!canSubmitCurrentStep.value || loading.value) return;
  await submitVerificationForm();
};

onMounted(() => {
  if (route.query.email) {
    credentials.value.email = route.query.email as string;
  }
  if (route.query.code) {
    emailSent.value = true;
  }
});
</script>

<template>
  <div
    class="mx-auto mt-8 flex w-full max-w-2xl flex-col items-center justify-center"
  >
    <form
      ref="forgetpassword"
      method="post"
      class="form w-full focus:bg-surface-subtle"
      autocomplete="on"
      @submit.prevent="submitForm"
    >
      <UiTitle> Verify Your Account</UiTitle>
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
        :progress-visible="emailSent && resendCountDown > 0"
        :progress="progressPercent"
        progress-label="Verification code resend cooldown"
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
          <span v-if="resendCountDown > 0"
            >Resend in: {{ resendCountDown }}s.</span
          >
          <UiButton
            v-else
            variant="link"
            size="xs"
            type="button"
            :disabled="!canResend"
            @click.prevent="handleSendEmail"
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
  <auth-resend-blocked-toast
    :seconds="resendCountDown"
    :attempts="remainingAttempts"
  />
</template>

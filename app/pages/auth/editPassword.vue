<script setup lang="ts">
// Remember to disable the middleware protection from your page!
definePageMeta({
  auth: { unauthenticatedOnly: true, navigateAuthenticatedTo: "/" },
});

const route = useRoute();
// Check if we are creating a new password or resetting an existing one
const createNewPassword = ref(route.query.newPassword);

// Use the composable for all password reset logic
import { usePasswordResetVerification } from '@/composables/auth/usePasswordResetVerification'
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
  showToast,
  sendResetEmail,
  verifyResetCode,
} = usePasswordResetVerification('reset-throttle')

/**
 * Handle form submission
 * - If email not sent yet: send reset email
 * - If email sent: verify the code
 */
const submitForm = async (): Promise<void> => {
  if (!emailSent.value) {
    await sendResetEmail();
  } else {
    await verifyResetCode();
  }
};
</script>

<template>
  <div>
    <div v-if="!verified" class="flex items-center justify-center flex-col w-full max-w-xl mx-auto mt-8 ">

      <form ref="forgetpassword" method="post" class="form w-full focus:bg-gray-100" autocomplete="test"
        @submit.prevent="submitForm">
        <UiTitle> {{ createNewPassword ? "Create" : "Reset" }} Password</UiTitle>
        <UiParagraph size="sm" color="muted">
          Enter your email to receive a verification code
        </UiParagraph>
        <shared-error-message v-if="error" :error="error" />
        <shared-success-message v-if="success" :message="success" />

        <div class="mb-2 mt-2 rounded-md relative transition duration-10 00 text-xs">
          <ui-input-field id="verify-email-client" v-model="credentials.email!" :type="'email'" name="email"
            label="Email Address" title="Please enter your email address" tabindex="2" :styles="{
              inputField: `${emailSent ? ' rounded-b-none border-b' : ''}`,
            }" />
          <ui-input-field id="verify-code-client" v-model="credentials.verification!" type="text" name="verification"
            label="Verification Code" title="Please enter the verification code" tabindex="2" :styles="{
              // input: `${isValidPassword ? 'pt-8' : ''}`,
              inputField: `rounded-t-none  ${!emailSent ? ' -translate-y-full -z-10 hidden' : ''}`,
            }" />
          <button
            :class="`w-8 h-8 absolute right-2 bottom-2 border border-gray-500 rounded-full text-center grid place-items-center cursor-pointer hover:opacity-90 bg-primary hover:shadow`"
            type="submit" :disabled="loading" @click.prevent="submitForm">
            <icon v-if="!loading" name="i-heroicons-arrow-right" class="w-4 h-4 text-white" />
            <icon v-else name="uil:redo" class="w-4 h-4 animate-spin text-white" />
          </button>
        </div>

        <UiParagraph v-if="emailSent" size="sm" color="muted" class="mt-2 flex justify-end items-center">
          <div class="flex items-center gap-2">
            <span v-if="remainingAttempts !== null"> Attempts left: {{ remainingAttempts }}.</span>
            <span v-if="countDown > 0"> Resend in: {{ countDown }}s</span>
            <div v-if="countDown > 0" class="mt-2 flex items-center gap-2">
              <div class="relative h-5 w-5" aria-hidden="true">
                <div class="absolute inset-0 rounded-full bg-gray-200"></div>
                <div class="absolute inset-0 rounded-full"
                  :style="{ background: `conic-gradient(#30c3c6 ${progressPercent}%, #e5e7eb ${progressPercent}%)` }">
                </div>
                <div class="absolute inset-0.5 rounded-full bg-white"></div>
              </div>
            </div>
            <span v-else>
              <button class="underline cursor-pointer" :disabled="!canResend" @click.prevent="sendResetEmail">Resend
                Code</button>.
            </span>
          </div>
          <span v-if="inlineHintVisible" class="block mt-1 text-red-600">Resend limit reached. Please wait for
            cooldown.</span>
        </UiParagraph>
      </form>
    </div>
    <auth-create-password v-else :token="token" />
    <auth-resend-blocked-toast :seconds="countDown" :attempts="remainingAttempts" />
  </div>
</template>

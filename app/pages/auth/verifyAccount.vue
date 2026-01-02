<script setup lang="ts">
import { useEmailVerification } from '@/composables/auth/useEmailVerification'

// Remember to disable the middleware protection from your page!
definePageMeta({
  auth: false,
});
const route = useRoute();
// Managed by useEmailVerification composable

const codeInputRef = ref<HTMLInputElement | null>(null)
// Managed by useEmailVerification composable

onMounted(() => {
  if (route.query.email) {
    credentials.value.email = route.query.email as string;
  }
  if (route.query.code) {
    // Auto focus code input when code flag present
    nextTick(() => codeInputRef.value?.focus())
  }
});

const {
  credentials,
  emailSent,
  emailsCount,
  resendCountDown,
  remainingAttempts,
  loading,
  error,
  success,
  canResend,
  inlineHintVisible,
  progressPercent,
  showToast,
  handleSendEmail,
  handleSubmit,
  submitForm,
} = useEmailVerification('verify-throttle')
</script>

<template>
  <div class="flex items-center justify-center flex-col w-full max-w-xl mx-auto mt-8 ">

    <form ref="forgetpassword" method="post" class="form w-full focus:bg-gray-100" autocomplete="test"
      @submit.prevent="submitForm">
      <UiTitle> Verify Your Account</UiTitle>
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
        <ui-input-field id="verify-code-client" ref="codeInputRef" v-model="credentials.verification!" type="text"
          name="verification" label="Verification Code" title="Please enter the verification code" tabindex="2" :styles="{
            inputField: `rounded-t-none  ${!emailSent ? ' -translate-y-full -z-10 hidden' : ''}`,
          }" />
        <button
          :class="`w-8 h-8 absolute right-2 bottom-2 border rounded-full text-center grid place-items-center cursor-pointer hover:opacity-90 bg-primary hover:shadow`"
          type="submit" :disabled="loading" @click.prevent="submitForm">
          <icon v-if="!loading" name="i-heroicons-arrow-right" class="w-4 h-4 text-white" />
          <icon v-else name="uil:redo" class="w-4 h-4 animate-spin text-white" />
        </button>
      </div>

      <UiParagraph size="sm" color="muted" class="mt-2 flex justify-end items-center gap-2">

        <span v-if="remainingAttempts !== null"> Attempts left: {{ remainingAttempts }}.</span>
        <span v-if="resendCountDown > 0">Resend in: {{ resendCountDown }}s.</span>
        <div v-if="resendCountDown > 0" class="flex items-center gap-2">
          <div class="relative h-5 w-5" aria-hidden="true">
            <div class="absolute inset-0 rounded-full bg-gray-200"></div>
            <div class="absolute inset-0 rounded-full"
              :style="{ background: `conic-gradient(#30c3c6 ${progressPercent}%, #e5e7eb ${progressPercent}%)` }"></div>
            <div class="absolute inset-0.5 rounded-full bg-white"></div>
          </div>
          <div class="h-1 flex-1 bg-gray-200 rounded">
            <div class="h-1 bg-primary rounded transition-all" :style="{ width: progressPercent + '%' }" />
          </div>
        </div>
        <span v-else>
          <button class="underline cursor-pointer" :disabled="!canResend" @click.prevent="handleSendEmail">Resend
            Code</button>
        </span>
        <span v-if="inlineHintVisible" class="block mt-1 text-red-600">Resend limit reached. Please wait for
          cooldown.</span>
      </UiParagraph>

    </form>
  </div>
  <auth-resend-blocked-toast :seconds="resendCountDown" :attempts="remainingAttempts" />
</template>

<script setup lang="ts">
// Remember to disable the middleware protection from your page!
definePageMeta({
  auth: { unauthenticatedOnly: true, navigateAuthenticatedTo: "/workspaces" },
});

const { signIn, getProviders } = useAuth();
const { handleSubmit, credentials, error, loading } = useLogin();

const providers = await getProviders();
const mappedProviders = Object.values(providers).filter(
  (provider) => provider?.name !== "Credentials",
);

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const isValidEmail = computed(() => {
  return EMAIL_PATTERN.test(credentials.email.trim());
});

const isValidPassword = computed(() => {
  return credentials.password.length > 0;
});

const submitLogin = async () => {
  if (!isValidEmail.value || !isValidPassword.value || loading.value) return;
  await handleSubmit();
};
</script>

<template>
  <div
    class="mx-auto mt-8 flex w-full max-w-2xl flex-col items-center justify-center"
  >
    <form
      ref="login"
      method="post"
      class="form w-full"
      autocomplete="on"
      @submit.prevent="submitLogin"
    >
      <UiTitle>Login</UiTitle>
      <UiParagraph size="sm" color="content-on-background">
        Login to your account
      </UiParagraph>
      <shared-error-message v-if="error" :error="error" />
      <AuthStepFieldStack
        class="mb-2 mt-2 text-xs"
        :reveal="isValidEmail"
        :first-complete="isValidEmail"
        :loading="loading"
        :submit-disabled="!isValidEmail || !isValidPassword"
        submit-label="Submit login form"
      >
        <template #first>
          <ui-input-field
            id="login-email-client"
            v-model="credentials.email"
            type="email"
            name="email"
            label="Email Address"
            title="Please enter a valid email address"
            autocomplete="email"
            pattern="[^\s@]+@[^\s@]+\.[^\s@]+"
            tabindex="1"
            :styles="{
              input: 'pr-12',
              inputField: isValidEmail
                ? 'rounded-b-none border-b border-secondary'
                : '',
            }"
          />
        </template>

        <template #second>
          <ui-input-field
            id="login-password-client"
            v-model="credentials.password"
            type="password"
            name="password"
            label="Password"
            title="Please enter a valid password"
            autocomplete="current-password"
            tabindex="2"
            :styles="{
              input: 'pr-12',
              inputField: 'rounded-t-none',
            }"
          />
        </template>
      </AuthStepFieldStack>
      <div
        class="toggle-forms flex flex-col justify-between gap-2 text-content-on-background"
      >
        <UiParagraph size="xs" color="content-on-background">
          You don't have an account
          <router-link
            tabindex="4"
            class="font-semibold underline"
            to="/auth/signup"
          >
            Signup
          </router-link>
        </UiParagraph>
        <UiParagraph size="xs" color="content-on-background">
          Forgot your password
          <router-link
            tabindex="4"
            class="font-semibold underline"
            to="/auth/editPassword"
          >
            Reset Password
          </router-link>
        </UiParagraph>
      </div>
    </form>
    <div
      v-if="mappedProviders.length"
      class="flex flex-col justify-center mt-4"
    >
      <p class="text-center text-content-on-background text-xs mt-4 mb-2">
        Or sign in with a social account below 👇
      </p>
      <ui-button
        v-for="provider in mappedProviders"
        :key="provider?.id"
        class="border border-error justify-center"
        :disabled="loading"
        variant="ghost"
        color="error"
        type="button"
        tabindex="5"
        @click="signIn(provider?.id)"
      >
        Sign in with {{ provider?.name }}
      </ui-button>
    </div>
  </div>
</template>

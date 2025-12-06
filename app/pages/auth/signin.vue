<script setup lang="ts">
// Remember to disable the middleware protection from your page!
definePageMeta({
  auth: { unauthenticatedOnly: true, navigateAuthenticatedTo: "/" },
});

const { signIn, getProviders } = useAuth();
const { handleSubmit, credentials, error, loading } = useLogin();

const providers = await getProviders();
const mappedProviders = Object.values(providers).filter(
  (provider) => provider?.name !== "Credentials",
);

const isValidEmail = computed(() => {
  return credentials.email.includes("@");
});

const isValidPassword = computed(() => {
  return credentials.password.length > 0;
});
</script>

<template>
  <div class="flex items-center justify-center flex-col w-full max-w-xl mx-auto mt-8 ">
    <form ref="login" method="post" class="form w-full focus:bg-gray-100" autocomplete="test"
      @submit.prevent="handleSubmit">
      <UiTitle>Login</UiTitle>
      <UiParagraph size="sm" color="muted"> Login to your account</UiParagraph>
      <shared-error-message v-if="error" :error="error" />
      <div class="mb-2 mt-2 rounded-md relative transition duration-10 00 text-xs">
        <ui-input-field id="login-email-client" v-model="credentials.email" type="email" name="email"
          label="Email Address" title="Please enter a valid email address"
          pattern="[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,4}$" tabindex="1" :styles="{
            inputField: `${isValidEmail ? ' rounded-b-none border-b' : ''}`,
          }" />
        <ui-input-field id="login-password-client" v-model="credentials.password" type="password" name="password"
          label="Password" title="Please enter a valid password" tabindex="2" :styles="{
            input: `${isValidPassword ? 'pt-8' : ''}`,
            inputField: `rounded-t-none  ${!isValidEmail ? ' -translate-y-full -z-10 hidden' : ''}`,
          }" />
        <button :class="`w-8 h-8 absolute right-2 bottom-2 border border-gray-500 rounded-full text-center grid place-items-center cursor-pointer hover:opacity-90 bg-primary 
          focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-primary
          hover:shadow ${isValidEmail && isValidPassword ? ' ' : 'opacity-45'}`" type="submit"
          :disabled="!isValidEmail || !isValidPassword || loading" @click.prevent="handleSubmit"
          title="Submit Login Form" tabindex="3">
          <icon v-if="!loading" name="i-heroicons-arrow-right" class="w-4 h-4 text-white" />
          <icon v-else name="uil:redo" class="w-4 h-4 animate-spin text-white" />
        </button>
      </div>
      <div class="toggle-forms flex flex-col gap-2 justify-between  dark:text-gray-200">
        <UiParagraph size="xs" color="muted">
          You don't have an account
          <router-link tabindex="4" class="font-semibold underline" to="/auth/signup">
            Signup
          </router-link>
        </UiParagraph>
        <UiParagraph size="xs" color="muted">
          Forgot your password
          <router-link tabindex="4" class="font-semibold underline" to="/auth/editPassword">
            Reset Password
          </router-link>
        </UiParagraph>

      </div>
    </form>
    <div v-if="mappedProviders.length" class="flex flex-col justify-center mt-4">
      <p class="text-center text-gray-400 text-xs mt-4 mb-2">
        Or sign in with a social account below 👇
      </p>
      <u-button v-for="provider in mappedProviders" :key="provider?.id"
        class="border border-[#eb4034] justify-center disabled:opacity-50 dark:ring-white " :disabled="loading"
        variant="ghost" color="error" type="button" tabindex="5" @click="signIn(provider?.id)">
        Sign in with {{ provider?.name }}
      </u-button>
    </div>
  </div>
</template>

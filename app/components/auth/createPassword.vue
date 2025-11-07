<script setup lang="ts">
const route = useRoute();
const token = computed(() => route.query.token as string);

// Use composable for password creation logic
const {
  credentials,
  loading,
  error,
  success,
  createPassword,
} = useCreatePassword();

const handleSubmit = async (): Promise<void> => {
  if (!token.value) {
    return;
  }
  await createPassword(token.value);
};
</script>

<template>
  <div class="flex items-center justify-center flex-col w-full max-w-xl mx-auto">
    <form ref="login" method="post" class="form w-full focus:bg-gray-100" autocomplete="test" @submit="handleSubmit">
      <UiTitle>Create Password</UiTitle>
      <UiParagraph size="sm" color="muted" class="mb-4">
        This page will expire in 15 minutes
      </UiParagraph>
      <shared-error-message v-if="error" :error="error.message" />
      <shared-success-message v-if="success" :message="success" />
      <div class="mb-2 mt-2 rounded-md relative transition duration-10 00 text-xs">

        <div class="form-group">
          <ui-input-field id="login-email-client" v-model="credentials.password!" type="password" name="password"
            class="input" placeholder="Add your password..." autocomplete="false | unknown-autocomplete-value"
            tabindex="1" label="Password" />
        </div>
        <div class="form-group">
          <ui-input-field id="login-email-client" v-model="credentials.confirmPassword!" type="password"
            name="confirmPassword" class="input" placeholder="Confirm your password..."
            autocomplete="false | unknown-autocomplete-value" tabindex="2" label="Confirm Password" />
        </div>
      </div>
      <div>
        <u-button type="submit"  :disabled="loading" tabindex="3"
          @click.prevent="handleSubmit">
          Create
        </u-button>
      </div>
    </form>
  </div>
</template>

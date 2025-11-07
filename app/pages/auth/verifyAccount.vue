<script setup lang="ts">
// Remember to disable the middleware protection from your page!
definePageMeta({
  auth: false,
});
const router = useRouter();
const route = useRoute();
const loading = ref(false);
const error = ref("");
const success = ref(
  route.query.code ? "Verification code has been sent to your email" : "",
);

const emailSent = ref(route.query.code ? true : false);
const emailsCount = ref(route.query.code ? 1 : 0);
const resendCountDown = ref(route.query.code ? 30 : 0);

const credentials = ref({
  email: null,
  verification: null,
}) as Ref<{ email: string | null; verification: string | null }>;

onMounted(() => {
  if (route.query.email) {
    credentials.value.email = route.query.email as string;
  }
  if (route.query.code) {
    startCountDown();
  }
});

const handleSendEmail = async (): Promise<void> => {
  error.value = "";
  success.value = "";

  loading.value = false;

  if (!credentials.value.email) {
    error.value = "Please add your email";
    return;
  }

  if (emailsCount.value > 0) {
    resendCountDown.value += 30 * emailsCount.value;
  }
  loading.value = true;

  try {
    const { $api } = useNuxtApp();
    const data = await $api.auth.sendVerificationEmail(credentials.value.email);

    emailSent.value = true;
    success.value = data.message;
    emailsCount.value++;

    const interval = setInterval(() => {
      if (resendCountDown.value === 0) {
        clearInterval(interval);
        return;
      }
      resendCountDown.value--;
    }, emailsCount.value * 1000);
  } catch (err) {
    const serverError = err as Error;
    error.value = serverError.message || "An error occurred";
  } finally {
    loading.value = false;
  }
};

const handleSubmit = async (): Promise<void> => {
  error.value = "";

  if (!credentials.value.email || !credentials.value.verification) {
    error.value = "Please add your information";
    return;
  }
  loading.value = true;

  try {
    const { $api } = useNuxtApp();
    const data = await $api.auth.verifyAccount(
      credentials.value.email,
      credentials.value.verification,
    );

    success.value = data.message;
    if (data.body?.redirect) {
      setTimeout(() => {
        router.push(data.body!.redirect);
      }, 2000);
    }
  } catch (err) {
    const serverError = err as Error;
    error.value = serverError.message || "An error occurred";
  } finally {
    loading.value = false;
  }
};

const startCountDown = (): void => {
  const interval = setInterval(() => {
    if (resendCountDown.value === 0) {
      clearInterval(interval);
      return;
    }
    resendCountDown.value--;
  }, 1000);
};

const submitForm = async (): Promise<void> => {
  if (!emailSent.value) {
    await handleSendEmail();
  } else {
    await handleSubmit();
  }
};
</script>

<template>
  <div class="flex items-center justify-center flex-col w-full max-w-xl mx-auto">
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
          <ui-input-field id="verify-code-client" v-model="credentials.verification!" type="text" name="verification"
            label="Verification Code" title="Please enter the verification code" tabindex="2" :styles="{
              // input: `${isValidPassword ? 'pt-8' : ''}`,
              inputField: `rounded-t-none  ${!emailSent ? ' -translate-y-full -z-10 hidden' : ''}`,
            }" />
          <button
            :class="`w-8 h-8 absolute right-2 bottom-2 border rounded-full text-center grid place-items-center cursor-pointer hover:opacity-90 bg-primary hover:shadow`"
            type="submit" :disabled="loading" @click.prevent="submitForm">
            <icon v-if="!loading" name="i-heroicons-arrow-right" class="w-4 h-4 text-white" />
            <icon v-else name="uil:redo" class="w-4 h-4 animate-spin text-white" />
          </button>
        </div>

        <UiParagraph v-if="emailSent" size="xs" color="muted" class="mt-2">
          A verification code has been sent to your email.
          <span v-if="resendCountDown > 0"> You can resend a new code in {{ resendCountDown }} seconds.</span>
          <span v-else>
            <button class="underline" @click.prevent="handleSendEmail">Resend Code</button>.
          </span>
        </UiParagraph>

      </form>

    <!-- <form v-if="emailSent" ref="login" method="post" class="form w-full focus:bg-gray-100" autocomplete="test"
      @submit.prevent="handleSubmit">
      <h1 class="title">Verify your email</h1>
      <shared-error-message :error="error" />
      <shared-success-message :message="success" />
      <div class="form-group">
        <input id="login-email-client" v-model="credentials.email" type="email" name="email"
          class="input disabled:bg-gray-100" placeholder="Add your email..."
          autocomplete="false | unknown-autocomplete-value" tabindex="1"
          pattern="[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,4}$" title="Please enter a valid email address" disabled />
      </div>

      <div class="form-group">
        <input id="verify-client" v-model="credentials.verification" type="text" name="verify-client" class="input"
          placeholder="Write the verification code..." autocomplete="false | unknown-autocomplete-value" tabindex="2" />
      </div>
      <div class="flex items-center gap-x-2">
        <button v-if="emailSent" type="button" class="btn btn-small bg-theme disabled:opacity-50"
          :disabled="loading || resendCountDown > 0" tabindex="2" @click.prevent="handleSendEmail">
          Resend code
          <span v-if="resendCountDown !== 0"> in {{ resendCountDown }}</span>
        </button>
        <button v-if="emailSent" type="submit" class="btn btn-small bg-theme disabled:opacity-50" :disabled="loading"
          tabindex="3" @click.prevent="handleSubmit">
          Verify
        </button>
      </div>
    </form> -->
  </div>
</template>

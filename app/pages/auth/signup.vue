<script setup lang="ts">
definePageMeta({
    auth: { unauthenticatedOnly: true, navigateAuthenticatedTo: "/" },
})
const { getProviders, signIn } = useAuth()

const providers = await getProviders()

const mappedProviders = Object.values(providers).filter(
    (provider) => provider?.name !== "Credentials",
)

const { handleSubmit, credentials, fieldTypes, error, success, loading } =
    useRegister()
</script>

<template>
    <div class="flex items-center justify-center flex-col w-full max-w-xl mx-auto">
        <form ref="signup" method="post" class="form" autocomplete="test" @submit.prevent="handleSubmit()">
            <UiTitle>Sign up</UiTitle>
            <UiParagraph size="sm" color="muted">

                By register you will be able to
                <strong class="font-semibold">access all the features</strong> of the
                application!

            </UiParagraph>
            <shared-error-message :error="error" />
            <shared-success-message :message="success ? `${success}` : undefined" />
            <div class="mb-2 mt-2 rounded-md relative transition duration-10 00 text-xs">
                <ui-input-field id="register-name-client" v-model="credentials.name!" :type="fieldTypes.name"
                    name="name" label="Name" title="Please enter your name" tabindex="1" />
                <ui-input-field id="register-email-client" v-model="credentials.email!" :type="fieldTypes.email"
                    name="email" label="Email Address" title="Please enter a valid email address" tabindex="2" />
                <ui-input-field id="register-phone-client" v-model="credentials.phone!" :type="fieldTypes.phone"
                    name="phone" label="Phone" title="Please enter your phone number" tabindex="3" />
                <ui-input-field id="register-gender-client" v-model="credentials.gender!" :type="fieldTypes.gender"
                    name="gender" label="Gender" title="Please enter your gender" tabindex="4" />

                <ui-input-field id="login-password-client" v-model="credentials.password!" :type="fieldTypes.password"
                    name="password" label="Password" title="Please enter a valid password" tabindex="5" />
                <ui-input-field id="login-confirm-password-client" v-model="credentials.confirmPassword!"
                    :type="fieldTypes.confirmPassword" name="confirmPassword" label="Confirm Password"
                    title="Please enter a valid and matching password" tabindex="6" />
            </div>

            <div class="flex flex-col gap-2 items-start">
                <UiParagraph size="sm" color="muted">

                    Already have an account
                    <router-link class="font-semibold underline" tabindex="4" to="/auth/signIn">
                        Login
                    </router-link>
                </UiParagraph>
                <UButton :disabled="loading" size="lg" tabindex="5" @click.prevent="handleSubmit">
                    Sign up
                </UButton>
            </div>
        </form>
        <div v-if="mappedProviders.length" class="flex flex-col justify-center mt-4 gap-y-2">
            <UiParagraph size="sm" color="muted">

                Or sign up with a social account below 👇
            </UiParagraph>
            <button v-for="provider in mappedProviders" :key="provider?.id"
                class="btn btn-small bg-white dark:bg-[#eb4034] dark:ring-white" type="button" tabindex="6"
                @click="signIn(provider?.id)">
                Sign up with {{ provider?.name }}
            </button>
        </div>
    </div>
</template>

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
    <div class="flex items-center justify-center flex-col w-full max-w-md mx-auto mt-6 sm:mt-18 p-8 rounded-lg">
        <form ref="signup" method="post" class="form" autocomplete="test" @submit.prevent="handleSubmit()">
            <h1 class="title">Sign up</h1>
            <p class="text-gray-400 text-xs mb-3 mt-1">
                By register you will be able to save your projects and retrieve them
                anytime you need it.
            </p>
            <shared-error-message :error="error" />
            <shared-success-message :message="success ? `${success}` : undefined" />
            <div class="grid gap-y-4">
                <ui-input-field id="register-name-client" v-model="credentials.name!" :type="fieldTypes.name"
                    name="name" label="Name" title="Please enter your name" tabindex="1" />
                <ui-input-field id="register-email-client" v-model="credentials.email!" :type="fieldTypes.email"
                    name="email" label="Email Address" title="Please enter a valid email address" tabindex="2" />
                <ui-input-field id="register-gender-client" v-model="credentials.gender!" :type="fieldTypes.gender"
                    name="gender" label="Gender" title="Please enter your gender" tabindex="5" />

                <ui-input-field id="login-password-client" v-model="credentials.password!" :type="fieldTypes.password"
                    name="password" label="Password" title="Please enter a valid password" tabindex="8" />
                <ui-input-field id="login-confirm-password-client" v-model="credentials.confirmPassword!"
                    :type="fieldTypes.confirmPassword" name="confirmPassword" label="Confirm Password"
                    title="Please enter a valid and matching password" tabindex="9" />
            </div>

            <div class="toggle-forms mb-2 text-xs dark:text-gray-200">
                Already have an account
                <router-link class="font-semibold underline" tabindex="4" to="/auth/signIn">
                    Login
                </router-link>
            </div>
            <div>
                <button type="submit" class="btn btn-small bg-theme disabled:opacity-50" :disabled="loading"
                    tabindex="5" @click.prevent="handleSubmit">
                    Sign up
                </button>
            </div>
        </form>
        <div v-if="mappedProviders.length" class="flex flex-col justify-center mt-4">
            <p class="text-center text-gray-400 text-xs mt-4 mb-2">
                Or sign up with a social account below 👇
            </p>
            <button v-for="provider in mappedProviders" :key="provider?.id"
                class="btn btn-small bg-white dark:bg-[#eb4034] dark:ring-white" type="button" tabindex="6"
                @click="signIn(provider?.id)">
                Sign up with {{ provider?.name }}
            </button>
        </div>
    </div>
</template>

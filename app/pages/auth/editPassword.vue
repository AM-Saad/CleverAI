<script setup lang="ts">

// Remember to disable the middleware protection from your page!
definePageMeta({
    auth: false,
})
const route = useRoute()
const router = useRouter()
const loading = ref(false)
const error = ref("")
const success = ref("")

const emailSent = ref(false)
const emailsCount = ref(0)
const countDown = ref(30)

const verified = ref(false)
const token = ref()
const createNewPassword = ref(route.query.newPassword)
const credentials = ref({
    email: null,
    verification: null,
}) as Ref<{ email: string | null; verification: string | null }>

onMounted(() => {
    if (route.query.email) {
        credentials.value.email = route.query.email as string
    }
})
const handleSendEmail = async (): Promise<void> => {
    error.value = ""
    success.value = ""

    loading.value = false
    emailSent.value = false

    if (!credentials.value.email) {
        error.value = "Please add your email"
        return
    }
    if (emailsCount.value > 0) {
        countDown.value += 30 * emailsCount.value
    }

    loading.value = true

    try {
        const { $api } = useNuxtApp()
        const data = await $api.auth.requestPasswordReset(credentials.value.email)

        emailSent.value = true
        success.value = data.message
        emailsCount.value++

        const interval = setInterval(() => {
            if (countDown.value === 0) {
                clearInterval(interval)
                return
            }
            countDown.value--
        }, emailsCount.value * 1000)
    } catch (err) {
        const serverError = err as Error
        error.value = serverError.message || "An error occurred"
    } finally {
        loading.value = false
    }
}

const handleSubmit = async (): Promise<void> => {
    error.value = ""

    if (!credentials.value.email || !credentials.value.verification) {
        error.value = "Please add your information"
        return
    }
    loading.value = true

    try {
        const { $api } = useNuxtApp()
        const data = await $api.auth.verifyForgotPassword(
            credentials.value.email,
            credentials.value.verification
        )

        success.value = data.message
        verified.value = true
        token.value = data.body?.token || ""
        if (data.body?.token) {
            router.push({ query: { token: data.body.token } })
        }
    } catch (err) {
        const serverError = err as Error
        error.value = serverError.message || "An error occurred"
    } finally {
        loading.value = false
    }
}

onMounted(() => {
    if (route.query.token) {
        token.value = route.query.token as string
        verified.value = true
    }
})
</script>

<template>
    <div>
        <div v-if="!verified" class="flex items-center justify-center flex-col w-full max-w-xl mx-auto">
            <form v-if="!emailSent" ref="login" method="post" class="form w-full focus:bg-gray-100" autocomplete="test"
                @submit.prevent="handleSendEmail">
                <UiTitle>
                    {{ createNewPassword ? "Create" : "Reset" }} Password
                </UiTitle>
                <UiParagraph size="sm" color="muted">
                    Enter your email to receive a verification code
                </UiParagraph>
                <shared-error-message :error="error" />
                <div class="form-group">
                    <ui-input-field id="register-email-client" v-model="credentials.email!" :type='"email"' name="email"
                        label="Email Address" title="Please enter a valid email address" tabindex="2" />
                </div>
                <div>
                    <UButton v-if="!emailSent" type="button" :disabled="loading" tabindex="2"
                        @click.prevent="handleSendEmail">
                        Send
                    </UButton>
                </div>
            </form>

            <form v-if="emailSent" ref="login" method="post" class="form w-full focus:bg-gray-100" autocomplete="test"
                @submit.prevent="handleSubmit">
                <UiTitle>
                    {{ createNewPassword ? "Create" : "Reset" }} Password
                </UiTitle>
                <shared-error-message :error="error" />
                <shared-success-message :message="success" />
                <div class="form-group">
                    <input id="login-email-client" v-model="credentials.email" type="email" name="email"
                        class="input disabled:bg-gray-100" placeholder="Add your email..."
                        autocomplete="false | unknown-autocomplete-value" tabindex="1"
                        pattern="[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,4}$" title="Please enter a valid email address"
                        disabled>
                </div>

                <div class="form-group">
                    <input id="verify-client" v-model="credentials.verification" type="text" name="verify-client"
                        class="input" placeholder="Write the verification code..."
                        autocomplete="false | unknown-autocomplete-value" tabindex="2">
                </div>
                <div class="flex items-center gap-x-2">
                    <button v-if="emailSent" type="button" class="btn btn-small bg-theme disabled:opacity-50"
                        :disabled="loading || countDown > 0" tabindex="2" @click.prevent="handleSendEmail">
                        Resend code <span v-if="countDown !== 0"> in {{ countDown }}</span>
                    </button>
                    <button v-if="emailSent" type="submit" class="btn btn-small bg-theme disabled:opacity-50"
                        :disabled="loading" tabindex="3" @click.prevent="handleSubmit">
                        Verify
                    </button>
                </div>
            </form>
        </div>
        <auth-create-password v-else :token="token" />
    </div>
</template>

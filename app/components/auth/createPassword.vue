<script setup lang="ts">
const router = useRouter()
const route = useRoute()
const loading = ref(false)
const error = ref("")
const success = ref("")
const token = computed(() => route.query.token as string)
// const props = defineProps<{ token: string }>()
// const token = ref(props.token)
const credentials = ref({
  password: null,
  confirmPassword: null,
})

const handleSubmit = async (): Promise<void> => {
  error.value = ""

  if (!credentials.value.password || !credentials.value.confirmPassword) {
    error.value = "Please add your information"
    return
  }

  if (credentials.value.password !== credentials.value.confirmPassword) {
    error.value = "Passwords do not match"
    return
  }
  loading.value = true

  try {
    const response = await fetch("/api/password/create", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token.value}`,
      },
      body: JSON.stringify({
        password: credentials.value.password,
        confirmPassword: credentials.value.confirmPassword,
      }),
    })

    const data = await response.json()
    if (!response.ok) {
      error.value = data.message
      return
    }
    success.value =
      "Password created successfully, redirecting to login page..."

    setTimeout(() => {
      router.push("/auth/signIn")
    }, 4000)
  } catch (err) {
    console.error(err)
    const serverError = err as Error
    error.value = serverError.message || "An error occurred"
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div
    class="flex items-center justify-center flex-col w-full max-w-md mx-auto mt-6 sm:mt-20 bg-gray-50 dark:bg-transparent p-8 rounded-lg border"
  >
    <form
      ref="login"
      method="post"
      class="form w-full focus:bg-gray-100"
      autocomplete="test"
      @submit="handleSubmit"
    >
      <h1 class="title">Create Password</h1>
      <p class="text-sm text-gray-500">This page will expire in 3 minutes</p>
      <shared-error-message :error="error" />
      <shared-success-message :success="success" />
      <div class="form-group">
        <input
          id="login-email-client"
          v-model="credentials.password"
          type="password"
          name="password"
          class="input"
          placeholder="Add your password..."
          autocomplete="false | unknown-autocomplete-value"
          tabindex="1"
        />
      </div>
      <div class="form-group">
        <input
          id="login-email-client"
          v-model="credentials.confirmPassword"
          type="password"
          name="confirmPassword"
          class="input"
          placeholder="Confirm your password..."
          autocomplete="false | unknown-autocomplete-value"
          tabindex="2"
        />
      </div>
      <div>
        <button
          type="submit"
          class="btn btn-small bg-theme disabled:opacity-50"
          :disabled="loading"
          tabindex="3"
          @click.prevent="handleSubmit"
        >
          Create
        </button>
      </div>
    </form>
  </div>
</template>

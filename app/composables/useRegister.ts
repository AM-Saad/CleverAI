import { ref } from "vue"
import { RESOURCES } from "~/utils/constants/resources.enum"

//
interface useRegister {
  credentials: Ref<{ [key: string]: string }>
  fieldTypes: { [key: string]: string }
  error: Ref<string>
  success: Ref<string>
  loading: Ref<boolean>
  handleSubmit: () => Promise<void>
}

export function useRegister(): useRegister {
  const router = useRouter()

  const credentials = ref({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
    gender: "",
    phone: "",
    role: "USER",
  })
  const fieldTypes = reactive({
    name: "text",
    email: "email",
    password: "password",
    confirmPassword: "password",
    gender: "text",
    phone: "text",
  }) as { [key: string]: string }

  const error = ref("")
  const success = ref("")
  const loading = ref(false)

  const handleSubmit = async (): Promise<void> => {
    error.value = ""
    if (
      !credentials.value.name ||
      !credentials.value.email ||
      !credentials.value.password ||
      !credentials.value.gender
    ) {
      error.value = "Please add all required information"
      return
    }

    if (credentials.value.password !== credentials.value.confirmPassword) {
      error.value = "Passwords do not match"
      return
    }
    loading.value = true
    try {
      const response = await fetch(RESOURCES.AUTH_REGISTER_USER, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ ...credentials.value, provider: "credentials"}),
      })

      const data = await response.json()
      if (!response.ok) {
        error.value = data.message
        return
      }
      success.value = data.message

      router.push(data.body.redirect)
    } catch (err) {
      const serverError = err as Error
      error.value = serverError.message || "An error occurred"
    } finally {
      loading.value = false
    }
  }

  return {
    credentials,
    fieldTypes,
    error,
    success,
    loading,
    handleSubmit,
  }
}

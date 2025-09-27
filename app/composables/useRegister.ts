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
      !credentials.value.gender ||
      !credentials.value.phone
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
        // Extract field-specific validation errors from nested structure
        const fieldErrors = extractValidationErrors(data)

        if (fieldErrors.length > 0) {
          // Show specific field errors
          error.value = fieldErrors.map(err => `${err.field}: ${err.userMessage}`).join(', ')
        } else {
          // Fallback to generic message
          error.value = data.message || data.statusMessage || "Registration failed"
        }
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

  // Helper function to extract validation errors from nested response
  interface ValidationError {
    field: string
    userMessage: string
  }

  const extractValidationErrors = (errorResponse: unknown): ValidationError[] => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const response = errorResponse as any

      // Try the exact path from the API response: data.error.details.details.details
      let validationDetails = response?.data?.error?.details?.details?.details

      if (Array.isArray(validationDetails)) {
        return validationDetails.filter((item: unknown): item is ValidationError => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const errorItem = item as any
          return Boolean(
            typeof errorItem?.field === 'string' &&
            typeof errorItem?.userMessage === 'string'
          )
        })
      }

      // Fallback: try data.error.details.details
      validationDetails = response?.data?.error?.details?.details
      if (Array.isArray(validationDetails)) {
        return validationDetails.filter((item: unknown): item is ValidationError => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const errorItem = item as any
          return Boolean(
            typeof errorItem?.field === 'string' &&
            typeof errorItem?.userMessage === 'string'
          )
        })
      }

      // Final fallback: try data.error.details
      validationDetails = response?.data?.error?.details
      if (Array.isArray(validationDetails)) {
        return validationDetails.filter((item: unknown): item is ValidationError => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const errorItem = item as any
          return Boolean(
            typeof errorItem?.field === 'string' &&
            typeof errorItem?.userMessage === 'string'
          )
        })
      }
    } catch (e) {
      console.warn('Failed to extract validation errors:', e)
    }

    return []
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

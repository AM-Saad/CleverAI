
import { ref } from "vue"
import { useOffline } from "./useOffline"
//
interface useLogin {
  credentials: { email: string; password: string }
  error: Ref<string>
  success: Ref<string>
  loading: Ref<boolean>
  handleSubmit: () => Promise<void>
}

export function useLogin(): useLogin {
  const router = useRouter()
  const { signIn } = useAuth()

  const { handleOfflineSubmit } = useOffline()
  const credentials = reactive({
    email: "",
    password: "",
  })
  const loading = ref(false)
  const error = ref("")
  const success = ref("")

  const handleSubmit = async (): Promise<void> => {
    error.value = ""
    if (!credentials.email || !credentials.password) {
      error.value = "Please add your information"
      return
    }

    if (!navigator.onLine) {
      handleOfflineSubmit(credentials)
      return
    } else {
      loading.value = true
      try {
        const response = await signIn("credentials", {
          redirect: false,
          email: credentials.email,
          password: credentials.password,
        })

        if (response && response.error) {
          error.value = response.error
          console.log("Error logging in.", response.error)
          return
        }
         success.value = "Signed in successfully!"

            await router.push("/")
        console.log("Signed in successfully!")
      } catch (err) {
        console.log("Error logging in.", err)
        const serverError = err as Error
        error.value = serverError.message || "An error occurred"
      } finally {
        loading.value = false
      }
    }
  }

  return {
    credentials,
    error,
    success,
    loading,
    handleSubmit,
  }
}

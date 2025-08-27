/* eslint-disable no-console */
import { ref } from "vue"
import { AuthService } from "~/services/auth"
//
interface useGetMe {
  error: Ref<string>
  success: Ref<string>
  loading: Ref<boolean>
  handleSubmit: () => Promise<void>
}

export function useGetMe(email:string): useGetMe {

  const loading = ref(false)
  const error = ref("")
  const success = ref("")

  const handleSubmit = async (): Promise<void> => {
    error.value = ""

      loading.value = true
      try {
         await AuthService.verify(email)

      } catch (err) {
        console.log("Error logging in.", err)
        const serverError = err as Error
        error.value = serverError.message || "An error occurred"
      } finally {
        loading.value = false
      }
  }

  return {
    error,
    success,
    loading,
    handleSubmit,
  }
}

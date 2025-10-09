import { ref } from "vue"

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
         const { $api } = useNuxtApp()
         const result = await $api.auth.findUser(email)

         if (result.success) {
           success.value = result.data.message
         } else {
           error.value = result.error.message
         }

      } catch (err) {
        console.log("Error finding user.", err)
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

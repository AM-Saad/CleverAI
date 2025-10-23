import { APIError } from "@/services/FetchFactory";
//
interface useLogin {
  credentials: { email: string; password: string };
  error: Ref<APIError | null>;
  success: Ref<string>;
  loading: Ref<boolean>;
  handleSubmit: () => Promise<void>;
}

export function useLogin(): useLogin {
  const router = useRouter();
  const { signIn } = useAuth();

  const credentials = reactive({
    email: "",
    password: "",
  });
  const loading = ref(false);
  const error = ref<APIError | null>(null);
  const success = ref("");

  const handleSubmit = async (): Promise<void> => {
    error.value = null;
    if (!credentials.email || !credentials.password) {
      error.value = new APIError("Email and password are required");
      return;
    }

    loading.value = true;
    try {
      const response = await signIn("credentials", {
        redirect: false,
        email: credentials.email,
        password: credentials.password,
      });

      if (response && response.error) {
        error.value = new APIError(response.error);
        return;
      }
      success.value = "Signed in successfully!";

      await router.push("/folders");
    } catch (err) {
      const serverError = err as Error;
      error.value = new APIError(serverError.message || "An error occurred");
    } finally {
      loading.value = false;
    }
  };

  return {
    credentials,
    error,
    success,
    loading,
    handleSubmit,
  };
}

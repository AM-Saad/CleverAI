import { ref } from "vue";
import type { APIError } from "~/services/FetchFactory";

//
interface useRegister {
  credentials: Ref<{ [key: string]: string }>;
  fieldTypes: { [key: string]: string };
  error: Ref<APIError | null>;
  success: Ref<string>;
  loading: Ref<boolean>;
  handleSubmit: () => Promise<void>;
}

export function useRegister(): useRegister {
  const router = useRouter();

  const credentials = ref({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
    gender: "",
    role: "USER",
  });
  const fieldTypes = reactive({
    name: "text",
    email: "email",
    password: "password",
    confirmPassword: "password",
    gender: "text",
  }) as { [key: string]: string };

  const error = ref<APIError | null>(null);

  const success = ref("");
  const loading = ref(false);

  const handleSubmit = async (): Promise<void> => {
    // error.value = "";
    error.value = null;
    if (
      !credentials.value.name ||
      !credentials.value.email ||
      !credentials.value.password ||
      !credentials.value.gender
    ) {
      error.value = { message: "Please add all required information", status: 400, code: "validation_error", cause: undefined, name: "", details: undefined };
      return;
    }

    if (credentials.value.password !== credentials.value.confirmPassword) {
      error.value = { message: "Passwords do not match", status: 400, code: "validation_error", cause: undefined, name: "", details: undefined };
      return;
    }
    loading.value = true;
    try {
      const { $api } = useNuxtApp();
      const result = await $api.auth.register({
        name: credentials.value.name,
        email: credentials.value.email,
        password: credentials.value.password,
        confirmPassword: credentials.value.confirmPassword,
        gender: credentials.value.gender,
        role: credentials.value.role as "USER",
        provider: "credentials",
      });
      console.log("Registration result:", result);
      if (result.success) {
        const data = result.data;
        success.value = data.message;
        const maybeRedirect = data.redirect;
        if (maybeRedirect) {
          router.push(maybeRedirect);
        }
      } else {
        error.value = result.error;
      }
    } catch (err) {
      // Fallback error handling
      console.log("Registration error:", err);
      const serverError = err as APIError;
      error.value = serverError || { message: "Registration failed" };
    } finally {
      loading.value = false;
    }
  };

  // Helper function to extract validation errors from nested response
  // (Removed unused ValidationError interface after migration to unified error contract)

  // Legacy validation error extraction removed (server now returns normalized errors)

  return { credentials, fieldTypes, error: readonly(error), success, loading, handleSubmit };
}

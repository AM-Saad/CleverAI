import { ref } from "vue";

//
interface useRegister {
  credentials: Ref<{ [key: string]: string }>;
  fieldTypes: { [key: string]: string };
  error: Ref<string>;
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
    phone: "",
    role: "USER",
  });
  const fieldTypes = reactive({
    name: "text",
    email: "email",
    password: "password",
    confirmPassword: "password",
    gender: "text",
    phone: "text",
  }) as { [key: string]: string };

  const error = ref("");
  const success = ref("");
  const loading = ref(false);

  const handleSubmit = async (): Promise<void> => {
    error.value = "";
    if (
      !credentials.value.name ||
      !credentials.value.email ||
      !credentials.value.password ||
      !credentials.value.gender ||
      !credentials.value.phone
    ) {
      error.value = "Please add all required information";
      return;
    }

    if (credentials.value.password !== credentials.value.confirmPassword) {
      error.value = "Passwords do not match";
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
        phone: credentials.value.phone,
        gender: credentials.value.gender,
        role: credentials.value.role as "USER",
        provider: "credentials",
      });

      if (result.success) {
        const data = result.data;
        success.value = data.message;
        const maybeRedirect = data.redirect;
        if (maybeRedirect) {
          router.push(maybeRedirect);
        }
      } else {
        error.value = result.error.message;
      }
    } catch (err) {
      // Fallback error handling
      const serverError = err as Error;
      error.value = serverError.message || "Registration failed";
    } finally {
      loading.value = false;
    }
  };

  // Helper function to extract validation errors from nested response
  // (Removed unused ValidationError interface after migration to unified error contract)

  // Legacy validation error extraction removed (server now returns normalized errors)

  return { credentials, fieldTypes, error, success, loading, handleSubmit };
}

export default defineNuxtPlugin(() => {
  const route = useRoute();
  const router = useRouter();
  const toast = useToast();

  watch(
    () => route.query.integration_error,
    (value) => {
      const message = Array.isArray(value) ? value[0] : value;
      if (!message) return;

      toast.add({
        title: "Integration connection failed",
        description: decodeURIComponent(String(message)),
        color: "error",
      });

      const nextQuery = { ...route.query };
      delete nextQuery.integration_error;
      void router.replace({ query: nextQuery });
    },
    { immediate: true },
  );
});

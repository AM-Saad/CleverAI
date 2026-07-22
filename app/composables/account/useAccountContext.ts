export type AccountAppContext = "daily" | "learning";

export function useAccountContext() {
  const route = useRoute();
  const appContext = computed<AccountAppContext | null>(() =>
    route.query.app === "daily" || route.query.app === "learning"
      ? route.query.app
      : null,
  );
  const returnTo = computed(() => {
    if (
      typeof route.query.returnTo === "string" &&
      route.query.returnTo.startsWith("/") &&
      !route.query.returnTo.startsWith("//")
    ) {
      return route.query.returnTo;
    }
    if (appContext.value === "daily") return "/day";
    if (appContext.value === "learning") return "/learn";
    return "/";
  });
  const appLabel = computed(() =>
    appContext.value === "daily"
      ? "Daily"
      : appContext.value === "learning"
        ? "Learning"
        : "apps",
  );
  const contextQuery = computed(() =>
    appContext.value ? { app: appContext.value, returnTo: returnTo.value } : {},
  );

  function withContext(path: string, query: Record<string, string> = {}) {
    return { path, query: { ...contextQuery.value, ...query } };
  }

  return {
    appContext,
    appLabel,
    returnTo,
    contextQuery,
    isDaily: computed(() => appContext.value === "daily"),
    isLearning: computed(() => appContext.value === "learning"),
    accountHome: computed(() => withContext("/account")),
    withContext,
  };
}

// shared/composables/useDataFetch.ts

import type Result from "~/types/Result";

/**
 * Result-based useDataFetch - No more H3Error wrapping issues!
 * FetchFactory returns Result<T> instead of throwing, so no complex error extraction needed
 */
export function useDataFetch<T>(
  key: string,
  fetcher: () => Promise<Result<T>>,
) {
  const {
    data: result,
    pending,
    refresh,
    execute,
  } = useAsyncData<Result<T>>(key, fetcher);

  // Extract data and error from the Result - clean and type-safe!
  const data = computed(() =>
    result.value?.success ? result.value.data : null,
  );
  const error = computed(() =>
    result.value?.success === false ? result.value.error : null,
  );

  // Provide typed error for components
  const typedError = computed(() => error.value);

  return { data, pending, error: typedError, refresh, execute };
}

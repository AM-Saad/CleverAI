// shared/composables/useDataFetch.ts

import { APIError } from "~/services/FetchFactory"
// 🟢 useDataFetch.ts
export function useDataFetch<T>(key: string, fetcher: () => Promise<T>) {
  const { data, pending, error, refresh, execute } = useAsyncData<T>(key, fetcher)
  const typedError = computed(() =>
    error.value instanceof APIError ? error.value : null,
  )

  return { data, pending, error, typedError, refresh, execute }
}

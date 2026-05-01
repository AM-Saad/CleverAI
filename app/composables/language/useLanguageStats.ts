import type { LanguageStats } from "@shared/utils/language.contract";

export function useLanguageStats() {
  const { $api } = useNuxtApp();

  const operation = useOperation<LanguageStats>();

  const stats = computed(() => operation.data.value);
  const isLoading = computed(() => operation.pending.value);
  const error = computed(() => operation.error.value);

  const hasDueCards = computed(() => (stats.value?.due ?? 0) > 0);
  const totalEnrolled = computed(() => stats.value?.enrolled ?? 0);

  const refresh = async () => {
    return operation.execute(() => $api.language.getStats());
  };

  onMounted(() => {
    refresh();
  });

  return {
    stats,
    isLoading,
    error,
    hasDueCards,
    totalEnrolled,
    refresh,
  };
}

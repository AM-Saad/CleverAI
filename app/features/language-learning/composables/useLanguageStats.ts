import type { LanguageStats } from "@shared/utils/language.contract";
import { useLanguageLearningRuntime } from "./languageLearningRuntime";

export function useLanguageStats() {
  const languageRuntime = useLanguageLearningRuntime();

  const stats = computed<LanguageStats | null>(() => languageRuntime.stats.value);
  const isLoading = computed(() => languageRuntime.isLoadingStats.value);
  const error = computed(() => languageRuntime.statsError.value);

  const hasDueCards = computed(() => (stats.value?.due ?? 0) > 0);
  const totalEnrolled = computed(() => stats.value?.enrolled ?? 0);

  const refresh = async () => {
    return languageRuntime.refreshStats();
  };

  onMounted(() => {
    refresh();
  });

  watch(languageRuntime.wordBankRevision, () => {
    void refresh();
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

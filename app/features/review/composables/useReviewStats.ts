import { useOperation } from "~/composables/shared/useOperation";
import type { ReviewSummaryStats } from "@shared/utils/review.contract";

export interface UseReviewStatsOptions {
  workspaceId?: string | Ref<string | undefined>;
  immediate?: boolean;
  refreshInterval?: number;
}

export const useReviewStats = (options: UseReviewStatsOptions = {}) => {
  const { $api } = useNuxtApp();

  const workspaceIdRef = computed(() => {
    const id = options.workspaceId;
    return isRef(id) ? id.value : id;
  });

  const operation = useOperation<ReviewSummaryStats>();

  const stats = computed(() => operation.data.value);
  const isLoading = computed(() => operation.pending.value);
  const error = computed(() => operation.error.value);

  const hasDueCards = computed(() => (stats.value?.due ?? 0) > 0);
  const hasNewCards = computed(() => (stats.value?.new ?? 0) > 0);
  const hasLearningCards = computed(() => (stats.value?.learning ?? 0) > 0);
  const totalEnrolled = computed(() => stats.value?.total ?? 0);
  const isEmpty = computed(() => totalEnrolled.value === 0);

  const statusMessage = computed(() => {
    if (!stats.value) return null;
    if (isEmpty.value) return "No cards enrolled for review";
    if (hasDueCards.value) {
      const due = stats.value.due;
      return `${due} card${due === 1 ? "" : "s"} due for review`;
    }
    if (hasNewCards.value) {
      return `${stats.value.new} new card${stats.value.new === 1 ? "" : "s"} to learn`;
    }
    return "All caught up!";
  });

  const urgencyLevel = computed<"high" | "medium" | "low" | "none">(() => {
    if (!stats.value) return "none";
    if (stats.value.due >= 10) return "high";
    if (stats.value.due > 0) return "medium";
    if (stats.value.new > 0) return "low";
    return "none";
  });

  const fetchStats = async () => {
    await operation.execute(() => $api.review.getStats(workspaceIdRef.value));
  };

  const refresh = () => fetchStats();

  if (options.immediate !== false) {
    onMounted(() => {
      fetchStats();
    });
  }

  watch(workspaceIdRef, () => {
    fetchStats();
  });

  let intervalId: ReturnType<typeof setInterval> | null = null;
  if (options.refreshInterval && options.refreshInterval > 0) {
    onMounted(() => {
      intervalId = setInterval(fetchStats, options.refreshInterval);
    });
    onUnmounted(() => {
      if (intervalId) clearInterval(intervalId);
    });
  }

  return {
    stats: readonly(stats),
    isLoading: readonly(isLoading),
    error: readonly(error),
    typedError: operation.typedError,
    hasDueCards,
    hasNewCards,
    hasLearningCards,
    totalEnrolled,
    isEmpty,
    statusMessage,
    urgencyLevel,
    refresh,
    fetchStats,
    reset: operation.reset,
  };
};

import type { ReviewSummaryStats } from "~/shared/utils/review.contract";
import { useOperation } from "../shared/useOperation";

export interface UseReviewStatsOptions {
  /** Folder ID to filter stats (omit for global stats) */
  folderId?: string | Ref<string | undefined>;
  /** Auto-fetch on mount (default: true) */
  immediate?: boolean;
  /** Refetch interval in ms (0 = disabled) */
  refreshInterval?: number;
}

/**
 * Composable for fetching review stats.
 * Supports both global (all folders) and folder-specific stats.
 *
 * @example
 * // Global stats
 * const { stats, isLoading, refresh } = useReviewStats()
 *
 * @example
 * // Folder-specific stats
 * const { stats } = useReviewStats({ folderId: 'abc123' })
 *
 * @example
 * // Reactive folder ID
 * const folderId = ref('abc123')
 * const { stats } = useReviewStats({ folderId })
 */
export const useReviewStats = (options: UseReviewStatsOptions = {}) => {
  const { $api } = useNuxtApp();

  // Normalize folderId to a ref
  const folderIdRef = computed(() => {
    const id = options.folderId;
    return isRef(id) ? id.value : id;
  });

  // Use operation pattern for consistent error handling
  const operation = useOperation<ReviewSummaryStats>();

  // Alias for backward compatibility
  const stats = computed(() => operation.data.value);
  const isLoading = computed(() => operation.pending.value);
  const error = computed(() => operation.error.value);

  // Computed helpers for common checks
  const hasDueCards = computed(() => (stats.value?.due ?? 0) > 0);
  const hasNewCards = computed(() => (stats.value?.new ?? 0) > 0);
  const hasLearningCards = computed(() => (stats.value?.learning ?? 0) > 0);
  const totalEnrolled = computed(() => stats.value?.total ?? 0);
  const isEmpty = computed(() => totalEnrolled.value === 0);

  // Status message for UI
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
    return "All caught up! 🎉";
  });

  // Urgency level for styling
  const urgencyLevel = computed<"high" | "medium" | "low" | "none">(() => {
    if (!stats.value) return "none";
    if (stats.value.due >= 10) return "high";
    if (stats.value.due > 0) return "medium";
    if (stats.value.new > 0) return "low";
    return "none";
  });

  /**
   * Fetch stats from API
   */
  const fetchStats = async () => {
    await operation.execute(() => $api.review.getStats(folderIdRef.value));
  };

  /**
   * Refresh stats
   */
  const refresh = () => fetchStats();

  // Auto-fetch on mount if immediate is true (default)
  if (options.immediate !== false) {
    onMounted(() => {
      fetchStats();
    });
  }

  // Watch for folderId changes and refetch
  watch(folderIdRef, () => {
    fetchStats();
  });

  // Optional: refresh interval
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
    // State
    stats: readonly(stats),
    isLoading: readonly(isLoading),
    error: readonly(error),
    typedError: operation.typedError,

    // Computed helpers
    hasDueCards,
    hasNewCards,
    hasLearningCards,
    totalEnrolled,
    isEmpty,
    statusMessage,
    urgencyLevel,

    // Actions
    refresh,
    fetchStats,
    reset: operation.reset,
  };
};

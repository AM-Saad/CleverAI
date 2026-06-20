import {
  ref,
  watch,
  onMounted,
  onBeforeUnmount,
  toValue,
  type MaybeRefOrGetter,
} from "vue";
import type { ReviewWorkspaceStats } from "~/shared/utils/review.contract";

/**
 * Fetches per-workspace review stats for the workspaces list in one round trip
 * (batch endpoint), instead of N calls to /api/review/stats. Refetches when the
 * set of workspace ids changes and when a `refresh-review-stats` event fires
 * (e.g. after generating or enrolling cards). Failures are non-fatal — the list
 * still renders, just without the "thinking" signals.
 */
export function useWorkspaceReviewStats(
  workspaceIds: MaybeRefOrGetter<string[]>,
) {
  const { $api } = useNuxtApp();
  const statsMap = ref<Record<string, ReviewWorkspaceStats>>({});
  const loading = ref(false);

  async function fetchStats() {
    const ids = toValue(workspaceIds) ?? [];
    if (ids.length === 0) {
      statsMap.value = {};
      return;
    }
    loading.value = true;
    try {
      const result = await $api.review.getStatsBatch(ids);
      if (result.success) statsMap.value = result.data.stats;
    } catch (err) {
      console.error("[useWorkspaceReviewStats] failed to load stats", err);
    } finally {
      loading.value = false;
    }
  }

  function statsFor(id: string): ReviewWorkspaceStats | undefined {
    return statsMap.value[id];
  }

  /** % of enrolled cards that are mature, or null when nothing is enrolled. */
  function masteryFor(id: string): number | null {
    const s = statsMap.value[id];
    if (!s || s.total === 0) return null;
    return Math.round((s.mature / s.total) * 100);
  }

  // Refetch only when the actual set of ids changes (string key avoids churn
  // from new array identities on every list recompute).
  watch(
    () => (toValue(workspaceIds) ?? []).join(","),
    () => fetchStats(),
  );

  const onRefresh = () => fetchStats();
  onMounted(() => {
    fetchStats();
    if (import.meta.client) window.addEventListener("refresh-review-stats", onRefresh);
  });
  onBeforeUnmount(() => {
    if (import.meta.client) window.removeEventListener("refresh-review-stats", onRefresh);
  });

  return { statsMap, loading, statsFor, masteryFor, refresh: fetchStats };
}

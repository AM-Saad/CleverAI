import { ref, readonly } from "vue";
import type { UserProgress } from "@@/shared/utils/user.contract";

export interface SessionSummary {
  xpGained: number;
  levelBefore: number;
  levelAfter: number;
  leveledUp: boolean;
  stageBefore: string;
  stageAfter: string;
  stageUnlocked: boolean;
}

export const useSessionSummary = () => {
  const { $api } = useNuxtApp();

  const isReady = ref(false);
  const summary = ref<SessionSummary | null>(null);

  // Internal state to store start snapshot
  const startProgress = ref<UserProgress | null>(null);

  // Helper to fetch current progress
  const fetchProgress = async (): Promise<UserProgress | null> => {
    try {
      console.log('[useSessionSummary] Fetching user progress...');
      const result = await $api.user.getProgress();
      if (!result.success || !result.data) {
        console.error('[useSessionSummary] Failed to fetch user progress (API error):', result.error);
        return null;
      }
      console.log('[useSessionSummary] Fetched progress:', result.data);
      return result.data;
    } catch (err) {
      console.error("[useSessionSummary] Failed to fetch user progress:", err);
      return null;
    }
  };

  /**
   * Initializes the session by snapshotting current user progress.
   * Call this when the review session begins (e.g., component mount or queue load).
   */
  const startSession = async () => {
    console.log('[useSessionSummary] Starting session...');
    isReady.value = false;
    summary.value = null;
    const progress = await fetchProgress();
    startProgress.value = progress;
    if (progress) {
      console.log('[useSessionSummary] Start progress set:', progress);
    } else {
      console.warn('[useSessionSummary] FAILED to set start progress (null response)');
    }
    isReady.value = true;
  };

  /**
   * Ends the session, compares current progress to start snapshot, and computes summary.
   * Call this when the review queue is exhausted or user exits.
   */
  const endSession = async () => {
    console.log('[useSessionSummary] Ending session...');
    if (!startProgress.value) {
      console.warn("[useSessionSummary] Session ended without valid start snapshot.");
      return;
    }
    console.log('[useSessionSummary] Start snapshot exists. Fetching end progress...');

    const endProgress = await fetchProgress();
    if (!endProgress) {
      console.warn("[useSessionSummary] Failed to fetch end progress.");
      return;
    }
    console.log('[useSessionSummary] End progress fetched:', endProgress);

    const start = startProgress.value;
    const end = endProgress;

    // Compute derived stats
    // Note: This logic assumes no negative XP logic exists

    let xpGained = 0;

    if (end.level === start.level) {
      xpGained = end.xpIntoLevel - start.xpIntoLevel;
    } else {
      // XP remaining to finish the starting level
      xpGained += (start.xpForNextLevel - start.xpIntoLevel);

      // XP earned in the final level
      xpGained += end.xpIntoLevel;
    }

    // Safety check for negative XP (should not happen)
    xpGained = Math.max(0, xpGained);

    const result = {
      xpGained,
      levelBefore: start.level,
      levelAfter: end.level,
      leveledUp: end.level > start.level,
      stageBefore: start.stage,
      stageAfter: end.stage,
      stageUnlocked: end.stage !== start.stage,
    };

    console.log('[useSessionSummary] Computed summary:', result);
    summary.value = result;
  };

  return {
    isReady: readonly(isReady),
    summary: readonly(summary),
    startSession,
    endSession,
  };
};

import { ref, readonly } from "vue";
import type { UserProgress } from "@shared/utils/user.contract";

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
  const startProgress = ref<UserProgress | null>(null);

  const fetchProgress = async (): Promise<UserProgress | null> => {
    try {
      const result = await $api.user.getProgress();
      if (result.success) {
        return result.data;
      }

      console.error(
        "[useSessionSummary] Failed to fetch user progress:",
        result.error,
      );
      return null;
    } catch (err) {
      console.error("[useSessionSummary] Failed to fetch user progress:", err);
      return null;
    }
  };

  const startSession = async () => {
    isReady.value = false;
    summary.value = null;
    startProgress.value = await fetchProgress();
    isReady.value = true;
  };

  const endSession = async () => {
    if (!startProgress.value) return;

    const endProgress = await fetchProgress();
    if (!endProgress) return;

    const start = startProgress.value;
    const end = endProgress;

    let xpGained = 0;
    if (end.level === start.level) {
      xpGained = end.xpIntoLevel - start.xpIntoLevel;
    } else {
      xpGained += start.xpForNextLevel - start.xpIntoLevel;
      xpGained += end.xpIntoLevel;
    }

    summary.value = {
      xpGained: Math.max(0, xpGained),
      levelBefore: start.level,
      levelAfter: end.level,
      leveledUp: end.level > start.level,
      stageBefore: start.stage,
      stageAfter: end.stage,
      stageUnlocked: end.stage !== start.stage,
    };
  };

  return {
    isReady: readonly(isReady),
    summary: readonly(summary),
    startSession,
    endSession,
  };
};

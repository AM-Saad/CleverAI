/**
 * Calculates the XP required to complete the current level and advance to the next.
 * Formula: 50 * level ^ 2
 * @param level Current level
 * @returns XP needed to pass this level
 */
export function xpToNextLevel(level: number): number {
  return 50 * level * level;
}

/**
 * Determines the Stage name based on the user's level.
 * @param level Current user level
 * @returns Stage name string
 */
export function getStageFromLevel(level: number): string {
  if (level <= 3) return "Explorer";
  if (level <= 7) return "Learner";
  if (level <= 14) return "Scholar";
  if (level <= 24) return "Thinker";
  if (level <= 39) return "Architect";
  if (level <= 59) return "Master";
  return "Sage";
}

export interface LevelProgress {
  level: number;
  xpIntoLevel: number;
  xpForNextLevel: number;
  progressPercent: number;
}

/**
 * Derives the current level and progress from total accumulated XP.
 * Iterates through levels until the remaining XP is less than the cost of the next level.
 * @param totalXP Total accumulated XP
 * @returns LevelProgress object
 */
export function getLevelFromTotalXP(totalXP: number): LevelProgress {
  let level = 1;
  let remainingXP = Math.max(0, totalXP);

  while (true) {
    const cost = xpToNextLevel(level);
    if (remainingXP < cost) {
      break;
    }
    remainingXP -= cost;
    level++;
  }

  const costNext = xpToNextLevel(level);
  // Calculate percentage, formatted to integer
  // Requirement: Cap at 99% to avoid confusion with level up
  const progressPercent =
    costNext > 0
      ? Math.min(99, Math.floor((remainingXP / costNext) * 100))
      : 99;

  return {
    level,
    xpIntoLevel: remainingXP,
    xpForNextLevel: costNext,
    progressPercent,
  };
}

export interface UserProgress extends LevelProgress {
  stage: string;
}

/**
 * value-added selector to get full user progress info.
 * @param totalXP Total accumulated XP
 * @returns UserProgress object
 */
export function getUserProgress(totalXP: number): UserProgress {
  const progress = getLevelFromTotalXP(totalXP);
  const stage = getStageFromLevel(progress.level);

  return {
    ...progress,
    stage,
  };
}

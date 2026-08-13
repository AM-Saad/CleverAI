export function shouldShowDayRolloverAttention({
  previousTodayKey,
  currentTodayKey,
  visibleDateKey,
}: {
  previousTodayKey: string;
  currentTodayKey: string;
  visibleDateKey: string;
}) {
  return (
    previousTodayKey !== currentTodayKey && visibleDateKey !== currentTodayKey
  );
}

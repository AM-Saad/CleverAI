/**
 * Composable for managing study session timing and statistics
 * Tracks session duration and number of reviews completed
 */
export const useSessionTimer = () => {
  // Session state
  const sessionTime = ref(0); // Seconds elapsed
  const sessionStartTime = ref(Date.now()); // Session start timestamp
  const reviewCount = ref(0); // Number of cards reviewed this session

  // Timer interval reference
  let timerInterval: NodeJS.Timeout | null = null;

  /**
   * Format seconds into human-readable time
   * Examples: "0:05", "1:23", "1:23:45"
   *
   * @param seconds - Total seconds to format
   * @returns Formatted time string
   */
  const formatTime = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hours > 0) {
      return `${hours}:${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
    }
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  /**
   * Start the session timer
   * Automatically updates sessionTime every second
   */
  const start = () => {
    if (timerInterval) return; // Already running

    sessionStartTime.value = Date.now();
    sessionTime.value = 0;

    timerInterval = setInterval(() => {
      sessionTime.value = Math.floor(
        (Date.now() - sessionStartTime.value) / 1000
      );
    }, 1000);
  };

  /**
   * Stop the session timer
   */
  const stop = () => {
    if (timerInterval) {
      clearInterval(timerInterval);
      timerInterval = null;
    }
  };

  /**
   * Reset session statistics
   * Resets time and review count, restarts timer
   */
  const reset = () => {
    stop();
    sessionTime.value = 0;
    reviewCount.value = 0;
    sessionStartTime.value = Date.now();
    start();
  };

  /**
   * Increment the review count
   * Call this when a card is successfully graded
   */
  const incrementReviews = () => {
    reviewCount.value++;
  };

  /**
   * Get session duration in milliseconds
   */
  const getSessionDuration = (): number => {
    return Date.now() - sessionStartTime.value;
  };

  /**
   * Get average time per review in seconds
   */
  const getAverageTimePerReview = (): number => {
    if (reviewCount.value === 0) return 0;
    return Math.floor(sessionTime.value / reviewCount.value);
  };

  // Auto-start timer on composable creation
  start();

  // Cleanup on unmount
  onUnmounted(() => {
    stop();
  });

  return {
    // State
    sessionTime: readonly(sessionTime),
    sessionStartTime: readonly(sessionStartTime),
    reviewCount: readonly(reviewCount),

    // Methods
    formatTime,
    start,
    stop,
    reset,
    incrementReviews,
    getSessionDuration,
    getAverageTimePerReview,
  };
};

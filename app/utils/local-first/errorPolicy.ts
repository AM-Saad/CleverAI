export interface LocalFirstErrorPolicy {
  reset(): void;
  scheduleRetry(input: {
    workspaceId: string;
    reason?: string;
    retry: () => void;
    onTerminalFailure?: () => void;
  }): void;
  attempts(): number;
}

export function isLocalFirstConflict(error: unknown): boolean {
  const message =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : "";

  return /conflict|version_mismatch|layoutConflict/i.test(message);
}

export function createLocalFirstErrorPolicy(options?: {
  maxAttempts?: number;
  baseDelay?: number;
  maxDelay?: number;
  jitterPct?: number;
  onRetryScheduled?: (event: {
    workspaceId: string;
    reason: string;
    attempt: number;
    delay: number;
  }) => void;
  setTimeoutFn?: typeof setTimeout;
  clearTimeoutFn?: typeof clearTimeout;
}): LocalFirstErrorPolicy {
  const maxAttempts = options?.maxAttempts ?? 4;
  const baseDelay = options?.baseDelay ?? 1000;
  const maxDelay = options?.maxDelay ?? 60_000;
  const jitterPct = options?.jitterPct ?? 0.2;
  const onRetryScheduled = options?.onRetryScheduled;
  const setTimer = options?.setTimeoutFn ?? setTimeout;
  const clearTimer = options?.clearTimeoutFn ?? clearTimeout;
  let attemptCount = 0;
  let timer: ReturnType<typeof setTimeout> | null = null;

  const calcDelay = () => {
    const raw = Math.min(baseDelay * Math.pow(2, attemptCount), maxDelay);
    const jitter = raw * jitterPct * (Math.random() * 2 - 1);
    return Math.max(0, Math.round(raw + jitter));
  };

  const reset = () => {
    attemptCount = 0;
    if (timer) {
      clearTimer(timer);
      timer = null;
    }
  };

  const scheduleRetry: LocalFirstErrorPolicy["scheduleRetry"] = ({
    workspaceId,
    reason = "scheduling-retry",
    retry,
    onTerminalFailure,
  }) => {
    if (attemptCount >= maxAttempts) {
      onTerminalFailure?.();
      return;
    }

    const delay = calcDelay();
    attemptCount++;
    onRetryScheduled?.({
      workspaceId,
      reason,
      attempt: attemptCount,
      delay,
    });
    timer = setTimer(() => {
      timer = null;
      retry();
    }, delay);
  };

  return {
    reset,
    scheduleRetry,
    attempts: () => attemptCount,
  };
}

/**
 * Creates a debounced version of a function that delays invoking func until after
 * wait milliseconds have elapsed since the last time the debounced function was invoked.
 *
 * @param func The function to debounce
 * @param wait The number of milliseconds to delay
 * @param immediate Trigger the function on the leading edge, instead of the trailing
 * @returns Returns the new debounced function
 */
export function debounce<T extends (...args: unknown[]) => unknown>(
  func: T,
  wait: number,
  immediate = false
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null;

  return function executedFunction(...args: Parameters<T>) {
    const later = () => {
      timeout = null;
      if (!immediate) func(...args);
    };

    const callNow = immediate && !timeout;

    if (timeout) {
      clearTimeout(timeout);
    }

    timeout = setTimeout(later, wait);

    if (callNow) {
      func(...args);
    }
  };
}

/**
 * Creates a throttled version of a function that only invokes func at most once per
 * every wait milliseconds.
 *
 * @param func The function to throttle
 * @param wait The number of milliseconds to throttle invocations to
 * @returns Returns the new throttled function
 */
export function throttle<T extends (...args: unknown[]) => unknown>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let inThrottle: boolean;
  let lastFunc: NodeJS.Timeout;
  let lastRan: number;

  return function executedFunction(...args: Parameters<T>) {
    if (!inThrottle) {
      func(...args);
      lastRan = Date.now();
      inThrottle = true;
    } else {
      clearTimeout(lastFunc);
      lastFunc = setTimeout(
        () => {
          if (Date.now() - lastRan >= wait) {
            func(...args);
            lastRan = Date.now();
          }
        },
        Math.max(wait - (Date.now() - lastRan), 0)
      );
    }
  };
}

/**
 * Composable for creating debounced functions in Vue components
 *
 * @param func The function to debounce
 * @param delay The debounce delay in milliseconds
 * @returns Object with the debounced function and utilities
 */
export function useDebounce<TArgs extends unknown[], TReturn = void>(
  func: (...args: TArgs) => TReturn | Promise<TReturn>,
  delay = 300
) {
  const isWaiting = ref(false);
  let timeoutId: NodeJS.Timeout | null = null;

  const debouncedFunc = (...args: TArgs) => {
    isWaiting.value = true;

    if (timeoutId) {
      clearTimeout(timeoutId);
    }

    timeoutId = setTimeout(() => {
      func(...args);
      isWaiting.value = false;
      timeoutId = null;
    }, delay);
  };

  const cancel = () => {
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutId = null;
      isWaiting.value = false;
    }
  };

  const flush = (...args: TArgs) => {
    cancel();
    func(...args);
  };

  // Cleanup on unmount
  onBeforeUnmount(() => {
    cancel();
  });

  return {
    debouncedFunc,
    isWaiting: readonly(isWaiting),
    cancel,
    flush,
  };
}

/**
 * A trailing async debouncer with independent timers per key. Calls made while
 * a key is in flight request exactly one follow-up run with the latest state.
 */
export function createKeyedAsyncDebounce<Key>(
  task: (key: Key) => Promise<unknown>,
  delay: number,
) {
  const timers = new Map<Key, ReturnType<typeof setTimeout>>();
  const inFlight = new Map<Key, Promise<void>>();
  const rerun = new Set<Key>();

  const run = (key: Key): Promise<void> => {
    const timer = timers.get(key);
    if (timer) {
      clearTimeout(timer);
      timers.delete(key);
    }

    const active = inFlight.get(key);
    if (active) {
      rerun.add(key);
      return active;
    }

    const execution = (async () => {
      do {
        rerun.delete(key);
        await task(key);
      } while (rerun.has(key));
    })();
    inFlight.set(key, execution);
    void execution.finally(() => {
      if (inFlight.get(key) === execution) inFlight.delete(key);
    });
    return execution;
  };

  const schedule = (key: Key) => {
    const timer = timers.get(key);
    if (timer) clearTimeout(timer);
    if (inFlight.has(key)) {
      rerun.add(key);
      return;
    }
    timers.set(key, setTimeout(() => {
      timers.delete(key);
      void run(key);
    }, delay));
  };

  const cancel = (key: Key) => {
    const timer = timers.get(key);
    if (timer) clearTimeout(timer);
    timers.delete(key);
    rerun.delete(key);
  };

  const cancelAll = () => {
    for (const timer of timers.values()) clearTimeout(timer);
    timers.clear();
    rerun.clear();
  };

  return {
    schedule,
    flush: run,
    flushAll: (keys: Iterable<Key>) => Promise.allSettled(Array.from(keys, run)),
    cancel,
    cancelAll,
    isPending: (key: Key) => timers.has(key) || inFlight.has(key) || rerun.has(key),
  };
}

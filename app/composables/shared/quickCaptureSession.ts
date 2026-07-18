export type QuickCaptureSessionState =
  | "idle"
  | "active"
  | "finalizing"
  | "finalized";

/**
 * Owns the lifecycle boundary shared by all quick-capture surfaces.
 *
 * A new session cannot reset mutable capture state until the previous
 * session's create/finalize work has settled. This prevents a stale async task
 * from clearing the source ID of a newly opened capture and causing the next
 * keystroke to allocate a second entity.
 */
export function createQuickCaptureSessionController() {
  let generation = 0;
  let state: QuickCaptureSessionState = "idle";
  let finalizePromise: Promise<void> | null = null;

  const isCurrent = (candidate: number) => candidate === generation;
  const currentGeneration = () => generation;

  async function begin(
    finalizePrevious: () => Promise<void>,
    reset: () => void,
  ): Promise<number> {
    if (finalizePromise) {
      await finalizePromise;
    } else if (state === "active") {
      await finalizePrevious();
    }

    generation += 1;
    reset();
    state = "active";
    return generation;
  }

  function finalize(
    work: (generation: number) => Promise<void>,
  ): Promise<void> {
    if (finalizePromise) return finalizePromise;
    if (state !== "active") return Promise.resolve();

    const finalizingGeneration = generation;
    state = "finalizing";
    const run = Promise.resolve().then(() => work(finalizingGeneration));
    let settled!: Promise<void>;
    settled = run.finally(() => {
      if (finalizePromise !== settled) return;
      finalizePromise = null;
      if (isCurrent(finalizingGeneration)) state = "finalized";
    });
    finalizePromise = settled;
    return settled;
  }

  function markFinalized() {
    state = "finalized";
  }

  return {
    begin,
    finalize,
    markFinalized,
    currentGeneration,
    isCurrent,
  };
}

/**
 * Mirrors Notes' editor lifecycle-flush pattern (see
 * `app/features/notes/composables/notesEditorRuntimeState.ts`): a page
 * unmounting is not the only way an in-progress edit can go unsaved — the tab
 * backgrounding (app switch, phone lock) or unloading must flush any pending
 * debounced save too, since neither fires `onBeforeUnmount`.
 */
type DraftFlusher = () => void | Promise<void>;

const draftFlushers = new Set<DraftFlusher>();
let lifecycleFlushInstalled = false;

function installLifecycleFlush() {
  if (lifecycleFlushInstalled || typeof window === "undefined") return;
  const flush = () => {
    void flushRegisteredDailyDrafts();
  };
  window.addEventListener("pagehide", flush);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") flush();
  });
  lifecycleFlushInstalled = true;
}

export function registerDailyDraftFlusher(flusher: DraftFlusher): () => void {
  installLifecycleFlush();
  draftFlushers.add(flusher);
  return () => {
    draftFlushers.delete(flusher);
  };
}

export async function flushRegisteredDailyDrafts(): Promise<void> {
  const flushers = Array.from(draftFlushers);
  await Promise.allSettled(flushers.map((flush) => Promise.resolve(flush())));
}

type DraftFlusher = () => void | Promise<void>;

const draftFlushers = new Set<DraftFlusher>();
let lifecycleFlushInstalled = false;

function installLifecycleFlush() {
  if (lifecycleFlushInstalled || typeof window === "undefined") return;
  const flush = () => { void flushRegisteredNotesDrafts(); };
  window.addEventListener("pagehide", flush);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") flush();
  });
  lifecycleFlushInstalled = true;
}

export function registerNotesDraftFlusher(flusher: DraftFlusher): () => void {
  installLifecycleFlush();
  draftFlushers.add(flusher);
  return () => {
    draftFlushers.delete(flusher);
  };
}

export async function flushRegisteredNotesDrafts(): Promise<void> {
  const flushers = Array.from(draftFlushers);
  await Promise.allSettled(flushers.map((flush) => Promise.resolve(flush())));
}

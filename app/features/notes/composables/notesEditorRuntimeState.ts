type DraftFlusher = () => void | Promise<void>;

const draftFlushers = new Set<DraftFlusher>();

export function registerNotesDraftFlusher(flusher: DraftFlusher): () => void {
  draftFlushers.add(flusher);
  return () => {
    draftFlushers.delete(flusher);
  };
}

export async function flushRegisteredNotesDrafts(): Promise<void> {
  const flushers = Array.from(draftFlushers);
  await Promise.allSettled(flushers.map((flush) => Promise.resolve(flush())));
}

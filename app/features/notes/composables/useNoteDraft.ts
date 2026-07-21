import { computed, onScopeDispose, ref, watch, type Ref } from "vue";
import type {
  NoteState,
  NotesStore,
} from "./useNotesStore";
import { registerNotesDraftFlusher } from "./notesEditorRuntimeState";

/**
 * useNoteDraft — the single draft-persistence pipeline for editing one note.
 *
 * Shared by the full editor page (/notes/[id]) and the quick-capture sheet so
 * both surfaces write through the exact same path:
 *  - `applyNoteDraft` is an in-memory echo only (instant UI on every
 *    keystroke — it neither writes IndexedDB nor enqueues a server sync)
 *  - the durable save is the debounced `updateNote` (upserts memory+IDB and
 *    queues the PATCH)
 *  - temp→real id resolution: an optimistic note's temp id is swapped for the
 *    server id after sync, so look up directly, then via the store alias map.
 */
export function useNoteDraft(
  store: Ref<NotesStore | null>,
  sourceId: Ref<string | null>,
  timing: {
    debounceMs?: number;
    maxWaitMs?: number;
  } = {},
) {
  const debounceMs = timing.debounceMs ?? 500;
  const maxWaitMs = timing.maxWaitMs ?? 2_000;
  const note = computed<NoteState | null>(() => {
    const s = store.value;
    const id = sourceId.value;
    if (!s || !id) return null;
    const direct = s.notes.value.get(id);
    if (direct) return direct;
    const resolved = s.resolveNoteId(id);
    return resolved ? (s.notes.value.get(resolved) ?? null) : null;
  });

  /** The id to use for store mutations (the note's real id once known). */
  const noteId = computed(() => note.value?.id ?? sourceId.value ?? "");

  const titleDraft = ref(note.value?.title ?? "");
  let draftRevision = 0;
  let durableRevision = 0;
  let draftEpoch = 0;
  let commitPromise: Promise<boolean> | null = null;
  let saveTimer: ReturnType<typeof setTimeout> | null = null;
  let maxSaveTimer: ReturnType<typeof setTimeout> | null = null;

  function cancelPendingSave() {
    if (saveTimer) {
      clearTimeout(saveTimer);
      saveTimer = null;
    }
    if (maxSaveTimer) {
      clearTimeout(maxSaveTimer);
      maxSaveTimer = null;
    }
  }

  // A source-id change means a different logical editor session. Temp-to-real
  // remaps do not change sourceId, so pending work survives acknowledgement.
  watch(
    sourceId,
    () => {
      cancelPendingSave();
      draftRevision = 0;
      durableRevision = 0;
      draftEpoch += 1;
      // The old request may finish, but it belongs to the previous epoch and
      // must not make the new note wait or update its durable revision.
      commitPromise = null;
    },
    { flush: "sync" },
  );
  watch(
    () => noteId.value,
    () => (titleDraft.value = note.value?.title ?? ""),
  );
  watch(
    () => note.value?.title,
    (t) => {
      if (t !== undefined && t !== titleDraft.value) titleDraft.value = t;
    },
  );

  function scheduleSave() {
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(() => void commitNow(), debounceMs);
    if (!maxSaveTimer) {
      maxSaveTimer = setTimeout(() => void commitNow(), maxWaitMs);
    }
  }
  async function commitNow() {
    cancelPendingSave();
    while (durableRevision < draftRevision) {
      if (commitPromise) {
        const committed = await commitPromise;
        if (!committed) return;
        continue;
      }

      const n = note.value;
      const s = store.value;
      if (!n || !s) return;
      const targetRevision = draftRevision;
      const targetEpoch = draftEpoch;
      const task = s.updateNote(noteId.value, {
        ...n,
        isDirty: true,
        updatedAt: new Date(),
      }).then((committed) => {
        if (committed && targetEpoch === draftEpoch) {
          durableRevision = Math.max(durableRevision, targetRevision);
        }
        return committed;
      }).finally(() => {
        if (commitPromise === task) commitPromise = null;
      });
      commitPromise = task;
      if (!(await task)) return;
    }
  }

  const unregisterDraftFlusher = registerNotesDraftFlusher(commitNow);
  onScopeDispose(unregisterDraftFlusher);

  function onTitle(v: string) {
    draftRevision += 1;
    titleDraft.value = v;
    store.value?.applyNoteDraft(noteId.value, { title: v });
    scheduleSave();
  }
  function onContent(html: string) {
    draftRevision += 1;
    store.value?.applyNoteDraft(noteId.value, { content: html });
    scheduleSave();
  }
  function onTags(tags: string[]) {
    const n = note.value;
    if (!n || !store.value) return;
    void store.value.updateNote(noteId.value, {
      ...n,
      tags,
      isDirty: true,
      updatedAt: new Date(),
    });
  }
  function onMetadata(metadata: Record<string, unknown>) {
    const n = note.value;
    if (!n || !store.value) return;
    // Persist ONLY metadata — never the text content. Canvas/math shapes live
    // in metadata; the note's `content` (which may hold real text from before
    // a conversion) must be preserved so converting between types is
    // reversible and non-destructive.
    draftRevision += 1;
    store.value.applyNoteDraft(noteId.value, { metadata });
    scheduleSave();
  }

  return {
    note,
    noteId,
    titleDraft,
    onTitle,
    onContent,
    onTags,
    onMetadata,
    commitNow,
    cancelPendingSave,
  };
}

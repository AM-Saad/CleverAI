import { computed, ref, watch, type Ref } from "vue";
import type {
  NoteState,
  NotesStore,
} from "~/features/notes/composables/useNotesStore";

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
) {
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

  let saveTimer: ReturnType<typeof setTimeout> | null = null;
  function scheduleSave() {
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(() => void commitNow(), 500);
  }
  function cancelPendingSave() {
    if (saveTimer) {
      clearTimeout(saveTimer);
      saveTimer = null;
    }
  }
  async function commitNow() {
    cancelPendingSave();
    const n = note.value;
    if (!n || !store.value) return;
    await store.value.updateNote(noteId.value, {
      ...n,
      isDirty: true,
      updatedAt: new Date(),
    });
  }

  function onTitle(v: string) {
    titleDraft.value = v;
    store.value?.applyNoteDraft(noteId.value, { title: v });
    scheduleSave();
  }
  function onContent(html: string) {
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

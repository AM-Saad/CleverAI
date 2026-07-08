import { computed, nextTick, ref, type Ref } from "vue";
import { TITLE_FALLBACK } from "@@/shared/utils/workspaceNote";
import type { NotesStore } from "~/features/notes/composables/useNotesStore";
import { useNoteDraft } from "~/features/notes/composables/useNoteDraft";

/**
 * useQuickNoteCapture — the lazy-create quick-capture pipeline, shared by the
 * notes page's QuickNoteSheet and the CaptureSheet's in-place editor.
 *
 * Nothing is created when the editor opens: the note is created on the first
 * typed character (title or body). Input that arrives while the create is in
 * flight is buffered and flushed into the draft pipeline once the id exists.
 * `finalize` keeps notes with real content and deletes typed-then-cleared
 * leftovers; if nothing was ever typed there is simply nothing to clean up.
 */
export function useQuickNoteCapture(store: Ref<NotesStore | null>) {
  const sourceId = ref<string | null>(null);
  const draft = useNoteDraft(store, sourceId);

  let groupId: string | null = null;
  let pendingTitle = "";
  let pendingContent = "";
  let createPromise: Promise<string | null> | null = null;
  let finalized = false;

  /** Reset for a fresh capture session (call when the editor opens). */
  function begin(targetGroupId: string | null = null) {
    sourceId.value = null;
    groupId = targetGroupId;
    pendingTitle = "";
    pendingContent = "";
    createPromise = null;
    finalized = false;
  }

  /**
   * Create the note now (idempotent — concurrent callers share the in-flight
   * create). Used on first input and by "open full".
   */
  function ensureCreated(): Promise<string | null> {
    if (sourceId.value) return Promise.resolve(draft.noteId.value);
    if (!store.value) return Promise.resolve(null);
    if (!createPromise) {
      const s = store.value;
      createPromise = (async () => {
        const id = await s.createNote(
          "",
          [],
          "TEXT",
          undefined,
          undefined,
          groupId,
        );
        if (!id) return null;
        sourceId.value = id;
        // Flush everything typed while the create was in flight.
        if (pendingTitle) draft.onTitle(pendingTitle);
        if (pendingContent) draft.onContent(pendingContent);
        return id;
      })().finally(() => {
        createPromise = null;
      });
    }
    return createPromise;
  }

  function onTitle(v: string) {
    pendingTitle = v;
    if (!sourceId.value) {
      if (v.trim()) void ensureCreated();
      return;
    }
    draft.onTitle(v);
  }

  function onContent(html: string) {
    pendingContent = html;
    if (!sourceId.value) {
      if (html.replace(/<[^>]*>/g, "").trim()) void ensureCreated();
      return;
    }
    draft.onContent(html);
  }

  /**
   * Settle the session after the editor closes: commit real content, delete
   * typed-then-cleared drafts. Safe to call multiple times.
   */
  async function finalize(): Promise<void> {
    if (finalized) return;
    finalized = true;
    if (createPromise) {
      await createPromise;
      await nextTick();
    }
    const note = draft.note.value;
    const id = draft.noteId.value;
    if (!store.value || !note || !id) {
      sourceId.value = null;
      return;
    }
    const title = draft.titleDraft.value ?? "";
    const hasTitle = title.trim().length > 0 && title !== TITLE_FALLBACK;
    const hasContent =
      (note.content ?? "").replace(/<[^>]*>/g, "").trim().length > 0;
    if (hasTitle || hasContent) {
      await draft.commitNow();
    } else {
      draft.cancelPendingSave();
      await store.value.deleteNote(id);
    }
    sourceId.value = null;
  }

  /** Navigating away — the note must survive even if still empty. */
  function markFinalized() {
    finalized = true;
  }

  const created = computed(() => Boolean(sourceId.value));

  return {
    note: draft.note,
    noteId: draft.noteId,
    created,
    begin,
    ensureCreated,
    onTitle,
    onContent,
    commitNow: draft.commitNow,
    finalize,
    markFinalized,
  };
}

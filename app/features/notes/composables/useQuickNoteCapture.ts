import {
  computed,
  nextTick,
  onScopeDispose,
  ref,
  shallowRef,
  type Ref,
} from "vue";
import { TITLE_FALLBACK } from "../../../../shared/utils/workspaceNote";
import { createQuickCaptureSessionController } from "../../../composables/shared/quickCaptureSession";
import type { NotesStore } from "./useNotesStore";
import { useNoteDraft } from "./useNoteDraft";
import { logNotesOperation } from "./notesOperationLog";

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
  // The selected workspace can change or the shell can clear its target while
  // a closing animation is still finalizing. Pin the store for the lifetime
  // of this capture so async work cannot jump to a different workspace.
  const sessionStore = shallowRef<NotesStore | null>(null);
  const draft = useNoteDraft(sessionStore, sourceId);

  let groupId: string | null = null;
  let pendingTitle = "";
  let pendingContent = "";
  let createPromise: Promise<string | null> | null = null;
  let syncTimer: ReturnType<typeof setTimeout> | null = null;
  const session = createQuickCaptureSessionController();

  function cancelScheduledSync() {
    if (!syncTimer) return;
    clearTimeout(syncTimer);
    syncTimer = null;
  }

  function scheduleSync() {
    cancelScheduledSync();
    const generation = session.currentGeneration();
    syncTimer = setTimeout(() => {
      syncTimer = null;
      if (!session.isCurrent(generation)) return;
      void sessionStore.value?.syncPendingChanges();
    }, 800);
  }
  onScopeDispose(cancelScheduledSync);

  /** Reset for a fresh capture session (call when the editor opens). */
  async function begin(targetGroupId: string | null = null) {
    await session.begin(finalize, () => {
      cancelScheduledSync();
      sourceId.value = null;
      sessionStore.value = store.value;
      groupId = targetGroupId;
      pendingTitle = "";
      pendingContent = "";
      createPromise = null;
    });
  }

  /**
   * Create the note now (idempotent — concurrent callers share the in-flight
   * create). Used on first input and by "open full".
   */
  function ensureCreated(): Promise<string | null> {
    if (sourceId.value) return Promise.resolve(draft.noteId.value);
    if (!sessionStore.value) return Promise.resolve(null);
    if (!createPromise) {
      const s = sessionStore.value;
      const generation = session.currentGeneration();
      const initialTitle = pendingTitle;
      const initialContent = pendingContent;
      const task = (async () => {
        const id = await s.createNote(
          initialContent,
          [],
          "TEXT",
          undefined,
          initialTitle || undefined,
          groupId,
          { deferSync: true },
        );
        if (!id) return null;
        // A previous capture may finish after the sheet has already opened a
        // new session. Its durable note remains valid, but it must not take
        // ownership of the new editor state.
        if (!session.isCurrent(generation)) return id;
        sourceId.value = id;
        // Flush only input that changed while the durable create was in
        // flight. The first captured title/body is already in note.create.
        const titleChanged = pendingTitle !== initialTitle;
        const contentChanged = pendingContent !== initialContent;
        if (titleChanged) draft.onTitle(pendingTitle);
        if (contentChanged) draft.onContent(pendingContent);
        logNotesOperation("capture-create-ready", {
          id,
          generation,
          titleChanged,
          contentChanged,
        });
        // If create already contains the complete capture there is no editor
        // commit to request a drain, so provide an idle fallback. Otherwise
        // the draft pipeline owns the debounce and sync trigger.
        if (!titleChanged && !contentChanged) scheduleSync();
        return id;
      })().finally(() => {
        if (createPromise === task) createPromise = null;
      });
      createPromise = task;
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
  function finalize(): Promise<void> {
    const generation = session.currentGeneration();
    logNotesOperation("capture-finalize", {
      generation,
      hasCreatePromise: Boolean(createPromise),
      sourceId: sourceId.value,
    });
    return session.finalize(async (finalizingGeneration) => {
      cancelScheduledSync();
      const pendingCreate = createPromise;
      if (pendingCreate) {
        await pendingCreate;
        await nextTick();
        cancelScheduledSync();
      }
      if (!session.isCurrent(finalizingGeneration)) return;

      const note = draft.note.value;
      const id = draft.noteId.value;
      const s = sessionStore.value;
      if (!s || !note || !id) {
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
        await s.deleteNote(id);
      }
      if (!session.isCurrent(finalizingGeneration)) return;
      // Creation is deliberately network-deferred so the first title/body and
      // the 500 ms editor debounce coalesce into one temp-id upsert. Closing
      // the sheet starts the drain without blocking its close animation.
      void s.syncPendingChanges();
      sourceId.value = null;
    });
  }

  /** Navigating away — the note must survive even if still empty. */
  function markFinalized() {
    session.markFinalized();
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

import type { ComputedRef } from "vue";
import type { DailyNoteConflict } from "../repositories/dailyLocalRepository";
import { useDebounce } from "~/utils/debounce";
import { registerDailyDraftFlusher } from "./dailyEditorRuntimeState";
import {
  buildDailyNoteDraftCommit,
  dailySaveStateLabel,
  resolveDailyEditorSaveState,
} from "./dailyDraftCommitter";
import { useDaily } from "./useDaily";

const EMPTY_NOTE_DOC = { type: "doc", content: [{ type: "paragraph" }] };

export function useDailyNoteDraft(input: {
  dateKey: ComputedRef<string>;
  projectedContent: ComputedRef<unknown>;
}) {
  const daily = useDaily();
  const noteContent = ref<unknown>(EMPTY_NOTE_DOC);
  const lastCommittedContent = ref<unknown>(EMPTY_NOTE_DOC);
  const hasLocalDraft = ref(false);
  const draftDateKey = ref(input.dateKey.value);
  const noteConflict = ref<DailyNoteConflict | null>(null);
  const noteSyncIssue = ref<string | null>(null);
  const saveError = ref<string | null>(null);
  let draftRevision = 0;
  let commitChain: Promise<void> = Promise.resolve();

  const saveState = computed(() =>
    resolveDailyEditorSaveState({
      hasLocalDraft: hasLocalDraft.value,
      isSyncing: daily.isSyncing.value,
      isConflicted: Boolean(noteConflict.value),
      hasError: Boolean(saveError.value),
      hasSyncIssue: Boolean(noteSyncIssue.value),
    }),
  );
  const noteSaveState = computed(() => dailySaveStateLabel(saveState.value));

  function commitDraft(
    forDateKey = draftDateKey.value,
    force = false,
  ): Promise<void> {
    if (noteConflict.value && !force) return Promise.resolve();
    const draft = buildDailyNoteDraftCommit(noteContent.value);
    const revision = draftRevision;
    const conflictMutationId = force
      ? noteConflict.value?.mutationId
      : undefined;
    const unchanged =
      JSON.stringify(draft.content) ===
      JSON.stringify(lastCommittedContent.value);
    if (unchanged) {
      hasLocalDraft.value = false;
      return Promise.resolve();
    }
    const run = commitChain.then(async () => {
      try {
        await daily.saveNote(forDateKey, draft.content, {
          dependsOn: conflictMutationId ? [conflictMutationId] : undefined,
        });
        if (draftDateKey.value !== forDateKey) return;
        lastCommittedContent.value = draft.content;
        if (
          draftRevision === revision &&
          JSON.stringify(noteContent.value) === JSON.stringify(draft.content)
        ) {
          hasLocalDraft.value = false;
        }
        saveError.value = null;
      } catch (error) {
        if (draftDateKey.value === forDateKey) {
          hasLocalDraft.value = true;
          saveError.value =
            error instanceof Error ? error.message : "Unable to save locally";
        }
        throw error;
      }
    });
    commitChain = run.catch(() => undefined);
    return run;
  }

  const { debouncedFunc: scheduleSave, cancel: cancelScheduledSave } =
    useDebounce(
      () => {
        void commitDraft().catch(() => undefined);
      },
      700,
      2_500,
    );

  function flushPendingSave(
    forDateKey = draftDateKey.value,
    force = false,
  ): Promise<void> {
    if (noteConflict.value && !force) return Promise.resolve();
    cancelScheduledSave();
    return commitDraft(forDateKey, force);
  }

  async function refreshNoteSyncState() {
    const [conflict, issue] = await Promise.all([
      daily.getNoteConflict(input.dateKey.value),
      daily.getNoteSyncIssue(input.dateKey.value),
    ]);
    noteConflict.value = conflict;
    noteSyncIssue.value = issue?.message ?? null;
  }

  async function resolveNoteConflict(strategy: "keep-local" | "keep-server") {
    await daily.resolveNoteConflict(input.dateKey.value, strategy);
    await refreshNoteSyncState();
  }

  function onNoteChange(value: unknown) {
    noteContent.value = value;
    draftRevision += 1;
    hasLocalDraft.value = true;
    saveError.value = null;
    noteSyncIssue.value = null;
    draftDateKey.value = input.dateKey.value;
    scheduleSave();
  }

  const unregister = registerDailyDraftFlusher(() => flushPendingSave());
  onScopeDispose(unregister);

  watch(
    input.dateKey,
    (next, previous) => {
      if (previous && previous !== next)
        void flushPendingSave(previous, true).catch(() => undefined);
      draftDateKey.value = next;
      hasLocalDraft.value = false;
      noteConflict.value = null;
      noteSyncIssue.value = null;
      saveError.value = null;
      void refreshNoteSyncState();
    },
    { immediate: true },
  );

  watch(
    () => daily.isSyncing.value,
    (isSyncing, wasSyncing) => {
      if (wasSyncing && !isSyncing) void refreshNoteSyncState();
    },
  );

  watch(
    input.projectedContent,
    (value) => {
      if (hasLocalDraft.value && draftDateKey.value === input.dateKey.value)
        return;
      const next = value ?? EMPTY_NOTE_DOC;
      noteContent.value = next;
      lastCommittedContent.value = next;
    },
    { immediate: true },
  );

  onBeforeUnmount(() => {
    void flushPendingSave().catch(() => undefined);
  });

  return {
    noteContent,
    noteConflict,
    noteSyncIssue,
    saveError,
    noteSaveState,
    onNoteChange,
    flushPendingSave,
    resolveNoteConflict,
  };
}

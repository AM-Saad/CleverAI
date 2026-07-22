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

  const saveState = computed(() =>
    resolveDailyEditorSaveState({
      hasLocalDraft: hasLocalDraft.value,
      isSyncing: daily.isSyncing.value,
      isConflicted: Boolean(noteConflict.value),
    }),
  );
  const noteSaveState = computed(() => dailySaveStateLabel(saveState.value));

  function commitDraft(forDateKey = draftDateKey.value, force = false) {
    if (noteConflict.value && !force) return;
    const draft = buildDailyNoteDraftCommit(noteContent.value);
    const unchanged =
      JSON.stringify(draft.content) ===
      JSON.stringify(lastCommittedContent.value);
    if (unchanged) {
      hasLocalDraft.value = false;
      return;
    }
    void daily.saveNote(forDateKey, draft.content).catch(() => undefined);
    lastCommittedContent.value = draft.content;
    hasLocalDraft.value = false;
  }

  const { debouncedFunc: scheduleSave, cancel: cancelScheduledSave } =
    useDebounce(() => commitDraft(), 700, 2_500);

  function flushPendingSave(forDateKey = draftDateKey.value, force = false) {
    if (noteConflict.value && !force) return;
    cancelScheduledSave();
    commitDraft(forDateKey, force);
  }

  async function refreshNoteConflict() {
    noteConflict.value = await daily.getNoteConflict(input.dateKey.value);
  }

  async function resolveNoteConflict(strategy: "keep-local" | "keep-server") {
    await daily.resolveNoteConflict(input.dateKey.value, strategy);
    noteConflict.value = null;
  }

  function onNoteChange(value: unknown) {
    noteContent.value = value;
    hasLocalDraft.value = true;
    draftDateKey.value = input.dateKey.value;
    scheduleSave();
  }

  const unregister = registerDailyDraftFlusher(() => flushPendingSave());
  onScopeDispose(unregister);

  watch(
    input.dateKey,
    (next, previous) => {
      if (previous && previous !== next) flushPendingSave(previous, true);
      draftDateKey.value = next;
      hasLocalDraft.value = false;
      noteConflict.value = null;
      void refreshNoteConflict();
    },
    { immediate: true },
  );

  watch(
    () => daily.isSyncing.value,
    (isSyncing, wasSyncing) => {
      if (wasSyncing && !isSyncing) void refreshNoteConflict();
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

  onBeforeUnmount(() => flushPendingSave());

  return {
    noteContent,
    noteConflict,
    noteSaveState,
    onNoteChange,
    flushPendingSave,
    resolveNoteConflict,
  };
}

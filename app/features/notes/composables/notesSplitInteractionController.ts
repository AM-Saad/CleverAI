import { ref } from "vue";
import type {
  SplitNotesInstance,
  SplitPosition,
} from "~/composables/ui/useSplitNotes";

export type SplitNoteCommand =
  | { type: "CLICK_SPLIT"; noteId: string }
  | { type: "DROP_SPLIT"; noteId: string; position: SplitPosition };

export function createNotesSplitInteractionController(input: {
  splitNotes: SplitNotesInstance;
  getCurrentNoteId: () => string | null;
  setCurrentNoteId: (noteId: string) => void;
}) {
  const isSplitDragging = ref(false);
  const hoveredSplitZone = ref<SplitPosition | null>(null);
  const draggedSplitNoteId = ref<string | null>(null);

  function noteWouldDuplicateOtherPane(noteId: string, targetPane: "primary" | "secondary") {
    if (targetPane === "primary") {
      return input.splitNotes.secondaryNoteId.value === noteId;
    }
    return input.splitNotes.primaryNoteId.value === noteId;
  }

  function replacePane(noteId: string, targetPane: "primary" | "secondary") {
    if (noteWouldDuplicateOtherPane(noteId, targetPane)) {
      return;
    }

    if (targetPane === "primary") {
      input.splitNotes.setPrimaryNote(noteId);
      input.splitNotes.setActivePane("primary");
    } else {
      input.splitNotes.setSecondaryNote(noteId);
      input.splitNotes.setActivePane("secondary");
    }
    input.setCurrentNoteId(noteId);
  }

  function paneForVisualSide(position: SplitPosition): "primary" | "secondary" {
    if (!input.splitNotes.isSplit.value) return "secondary";
    return input.splitNotes.secondaryPosition.value === position ? "secondary" : "primary";
  }

  function ensureSplit(noteId: string, position: SplitPosition = "right") {
    const currentNoteId = input.getCurrentNoteId();
    if (!currentNoteId || currentNoteId === noteId) return;

    input.splitNotes.setPrimaryNote(currentNoteId);
    input.splitNotes.openSplit(noteId, position);
    input.splitNotes.setActivePane("secondary");
    input.setCurrentNoteId(noteId);
  }

  function execute(command: SplitNoteCommand) {
    if (!input.splitNotes.isSplit.value) {
      ensureSplit(command.noteId, command.type === "DROP_SPLIT" ? command.position : "right");
      return;
    }

    if (command.type === "CLICK_SPLIT") {
      replacePane(command.noteId, input.splitNotes.activePane.value);
      return;
    }

    replacePane(command.noteId, paneForVisualSide(command.position));
  }

  function startSplitDrag(noteId: string) {
    draggedSplitNoteId.value = noteId;
    isSplitDragging.value = true;
  }

  function endSplitDrag() {
    isSplitDragging.value = false;
    hoveredSplitZone.value = null;
    draggedSplitNoteId.value = null;
  }

  function setHoveredZone(zone: SplitPosition | null) {
    hoveredSplitZone.value = zone;
  }

  return {
    isSplitDragging,
    hoveredSplitZone,
    draggedSplitNoteId,
    execute,
    startSplitDrag,
    endSplitDrag,
    setHoveredZone,
  };
}

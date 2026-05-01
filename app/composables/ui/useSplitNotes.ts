/**
 * useSplitNotes — Split-screen notes state composable.
 *
 * Manages which two notes are displayed side-by-side, which pane is
 * "active" (editable), and drag-hover state for the drop zones.
 * Persists to localStorage per workspace.
 */

export type SplitPosition = 'left' | 'right';
export type ActivePane = 'primary' | 'secondary';

interface SplitState {
  isSplit: boolean;
  primaryNoteId: string | null;
  secondaryNoteId: string | null;
  secondaryPosition: SplitPosition;
}

const STORAGE_KEY = (workspaceId: string) => `splitView_${workspaceId}`;

export function useSplitNotes(workspaceId: string, validNoteIds: () => Set<string>) {
  // ── Persisted state ──
  const isSplit = ref(false);
  const primaryNoteId = ref<string | null>(null);
  const secondaryNoteId = ref<string | null>(null);
  const secondaryPosition = ref<SplitPosition>('right');

  // ── Transient UI state ──
  const activePane = ref<ActivePane>('primary');
  const isDragOverEditor = ref(false);
  const hoveredZone = ref<'left' | 'right' | null>(null);

  // ── Derived ──

  /** The note ID currently displayed on the LEFT side */
  const leftNoteId = computed<string | null>(() => {
    if (!isSplit.value || !primaryNoteId.value || !secondaryNoteId.value) return primaryNoteId.value;
    return secondaryPosition.value === 'left' ? secondaryNoteId.value : primaryNoteId.value;
  });

  /** The note ID currently displayed on the RIGHT side */
  const rightNoteId = computed<string | null>(() => {
    if (!isSplit.value || !primaryNoteId.value || !secondaryNoteId.value) return null;
    return secondaryPosition.value === 'right' ? secondaryNoteId.value : primaryNoteId.value;
  });

  /** Which pane (left|right) is currently active */
  const activePaneSide = computed<'left' | 'right'>(() => {
    if (!isSplit.value) return 'left';
    if (activePane.value === 'primary') {
      return secondaryPosition.value === 'left' ? 'right' : 'left';
    } else {
      return secondaryPosition.value === 'left' ? 'left' : 'right';
    }
  });

  // ── Persistence ──
  function persist() {
    if (typeof window === 'undefined') return;
    try {
      const state: SplitState = {
        isSplit: isSplit.value,
        primaryNoteId: primaryNoteId.value,
        secondaryNoteId: secondaryNoteId.value,
        secondaryPosition: secondaryPosition.value,
      };
      localStorage.setItem(STORAGE_KEY(workspaceId), JSON.stringify(state));
    } catch { /* ignore */ }
  }

  function restore() {
    if (typeof window === 'undefined') return;
    try {
      const raw = localStorage.getItem(STORAGE_KEY(workspaceId));
      if (!raw) return;
      const state: SplitState = JSON.parse(raw);
      const valid = validNoteIds();

      // Validate note IDs still exist
      const primaryOk = state.primaryNoteId && valid.has(state.primaryNoteId);
      const secondaryOk = state.secondaryNoteId && valid.has(state.secondaryNoteId);

      if (state.isSplit && primaryOk && secondaryOk) {
        isSplit.value = true;
        primaryNoteId.value = state.primaryNoteId;
        secondaryNoteId.value = state.secondaryNoteId;
        secondaryPosition.value = state.secondaryPosition ?? 'right';
      } else if (primaryOk) {
        // Only primary survived — single view
        primaryNoteId.value = state.primaryNoteId;
      }
    } catch { /* ignore */ }
  }

  // ── Actions ──

  /**
   * Open split view. The `noteId` becomes the secondary note displayed at `position`.
   * The current `primaryNoteId` stays on the opposite side.
   */
  function openSplit(noteId: string, position: SplitPosition = 'right') {
    if (!primaryNoteId.value) return;
    // Guard: same note in both panes
    if (noteId === primaryNoteId.value) return;

    secondaryNoteId.value = noteId;
    secondaryPosition.value = position;
    isSplit.value = true;
    activePane.value = 'primary';
    persist();
  }

  /** Close split, keep primary as the single visible note */
  function closeSplit() {
    isSplit.value = false;
    secondaryNoteId.value = null;
    activePane.value = 'primary';
    persist();
  }

  /**
   * Close a specific pane. The surviving note becomes the single-view note.
   */
  function closePane(pane: ActivePane) {
    if (pane === 'secondary') {
      closeSplit();
    } else {
      // Promote secondary to primary
      if (secondaryNoteId.value) {
        primaryNoteId.value = secondaryNoteId.value;
      }
      closeSplit();
    }
  }

  /** Swap the left/right position of the two panes */
  function swapPanes() {
    secondaryPosition.value = secondaryPosition.value === 'right' ? 'left' : 'right';
    persist();
  }

  /** Set which pane is active (editable). The other becomes passive. */
  function setActivePane(pane: ActivePane) {
    activePane.value = pane;
  }

  /** Activate the left pane */
  function activateLeft() {
    if (!isSplit.value) return;
    const pane: ActivePane = secondaryPosition.value === 'left' ? 'secondary' : 'primary';
    setActivePane(pane);
  }

  /** Activate the right pane */
  function activateRight() {
    if (!isSplit.value) return;
    const pane: ActivePane = secondaryPosition.value === 'right' ? 'secondary' : 'primary';
    setActivePane(pane);
  }

  /**
   * Called when a note is deleted. If either split pane used this note,
   * gracefully fall back to single view.
   */
  function handleNoteDeleted(deletedId: string) {
    if (!isSplit.value) {
      if (primaryNoteId.value === deletedId) {
        primaryNoteId.value = null;
      }
      return;
    }
    if (deletedId === secondaryNoteId.value) {
      closeSplit();
    } else if (deletedId === primaryNoteId.value) {
      closePane('primary');
    }
  }

  /**
   * Sync primaryNoteId with the external currentNoteId.
   * Called when the user selects a different note in single-view mode.
   */
  function setPrimaryNote(noteId: string | null) {
    primaryNoteId.value = noteId;
    if (!isSplit.value) persist();
  }

  /** Update the secondary note (e.g. when the active pane is secondary and user picks a drawer item) */
  function setSecondaryNote(noteId: string) {
    if (!isSplit.value) return;
    secondaryNoteId.value = noteId;
    persist();
  }

  // ── Drag state helpers ──
  function startDragOver(zone: 'left' | 'right') {
    isDragOverEditor.value = true;
    hoveredZone.value = zone;
  }

  function endDragOver() {
    isDragOverEditor.value = false;
    hoveredZone.value = null;
  }

  return {
    // State
    isSplit: readonly(isSplit),
    primaryNoteId: readonly(primaryNoteId),
    secondaryNoteId: readonly(secondaryNoteId),
    secondaryPosition: readonly(secondaryPosition),
    activePane: readonly(activePane),
    isDragOverEditor: readonly(isDragOverEditor),
    hoveredZone: readonly(hoveredZone),
    // Derived
    leftNoteId,
    rightNoteId,
    activePaneSide,
    // Actions
    openSplit,
    closeSplit,
    closePane,
    swapPanes,
    setActivePane,
    activateLeft,
    activateRight,
    handleNoteDeleted,
    setPrimaryNote,
    setSecondaryNote,
    startDragOver,
    endDragOver,
    restore,
    persist,
  };
}

export type SplitNotesInstance = ReturnType<typeof useSplitNotes>;

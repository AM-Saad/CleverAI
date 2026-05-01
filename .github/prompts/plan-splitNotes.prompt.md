# Plan: Split-Screen Notes View

## TL;DR
Add a split-screen mode to the notes editor allowing users to view two notes side-by-side (left/right). Triggered primarily by dragging a note from the drawer to a drop zone over the editor, with a fallback button/context menu action. Works in both normal and fullscreen modes. One pane is "active" (editable), the other is "passive" (scrollable but read-only); clicking/interacting with the passive pane smoothly swaps active focus.

---

## Phase 1: State Management — `useSplitNotes` composable

**New file**: `app/composables/ui/useSplitNotes.ts`

Manages all split-screen state, isolated from the notes store:

- **State**:
  - `isSplit: Ref<boolean>` — whether split mode is active
  - `primaryNoteId: Ref<string | null>` — the "original" note (maps to existing `currentNoteId`)
  - `secondaryNoteId: Ref<string | null>` — the split-opened note
  - `secondaryPosition: Ref<'left' | 'right'>` — which side the secondary note occupies (default: `'right'`)
  - `activePane: Ref<'primary' | 'secondary'>` — which pane is currently editable
  - `isDragOverEditor: Ref<boolean>` — whether a split-drag is hovering over the editor area
  - `hoveredZone: Ref<'left' | 'right' | null>` — which drop zone is hovered during drag

- **Actions**:
  - `openSplit(noteId, position?)` — activate split with given note on given side
  - `closeSplit()` — exit split mode, keep primaryNoteId as current
  - `closePane(pane: 'primary' | 'secondary')` — close one pane, promote the other to single view
  - `swapPanes()` — swap left/right positions
  - `setActivePane(pane)` — switch which pane is editable (smooth CSS transition)

- **Persistence**: Save `{ isSplit, primaryNoteId, secondaryNoteId, secondaryPosition }` to `localStorage` keyed by `splitView_${workspaceId}`. Restore on mount. Clear when notes are deleted.

- **Validation**: If a persisted note ID no longer exists, gracefully fall back to single view.

**Depends on**: Nothing. Can be built first.

---

## Phase 2: Drag-to-Split Interaction

### 2a: Drawer drag handle (HTML5 DnD, separate from reorder)

**Modify**: `app/components/workspace/NotesSection.vue` — drawer items

Each note item in the `ReorderGroup` gets a small **split icon/grip** (e.g., `i-lucide-columns-2` or `i-lucide-split`) visible on hover/focus. This icon:
- Has `draggable="true"` with HTML5 native DnD
- On `dragstart`: sets `dataTransfer.setData('text/note-id', note.id)` + `dataTransfer.effectAllowed = 'copy'`
- On `dragend`: clears drag state

**Why separate from ReorderItem**: motion-v `ReorderItem` uses pointer events for y-axis reorder. The HTML5 `draggable` attribute on a child element (the split icon) creates a completely independent drag operation. The `ReorderItem` click-and-drag for reorder only activates on the main body of the item; the icon with `draggable` triggers native DnD which doesn't interfere with motion-v's pointer tracking.

**Key detail**: Add `@pointerdown.stop` on the drag handle to prevent motion-v from capturing the pointer event and starting a reorder. This is the critical separator.

### 2b: Drop zones over editor area

**New component**: `app/components/workspace/NotesSplitDropZone.vue`

An overlay component rendered on top of the editor area, visible only during an active note-drag:
- Listens to `dragenter`/`dragover`/`dragleave`/`drop` on the editor container
- Splits the editor area visually into **left half** and **right half** with a semi-transparent overlay + dashed border + icon
- Highlights the hovered zone (e.g., blue tinted background, "Drop here to split left/right" label)
- On `drop`: reads `dataTransfer.getData('text/note-id')`, calls `splitNotes.openSplit(noteId, zone)`
- On `dragleave` (leaving editor entirely): clears highlight

**Visual feedback**:
- Zone overlay: `bg-primary/10` with `border-2 border-dashed border-primary` and a centered `Columns` icon + label
- Hovered zone: `bg-primary/20` with `border-primary` solid
- Smooth `transition-all duration-200`

### 2c: Prevent conflicts with reorder

- The `ReorderGroup` axis is `y`; dragging within the list reorders
- The split drag handle (`draggable="true"` on icon) uses HTML5 DnD, which is a separate system
- `@pointerdown.stop` on the handle prevents motion-v from capturing it
- If the user drags the item body (not the icon), reorder happens as before
- If the user drags the icon, native DnD starts → drop zones appear → split happens

**Depends on**: Phase 1 composable.

---

## Phase 3: Split Editor Layout

**Modify**: `app/components/workspace/NotesSection.vue` — editor area

Replace the single-editor area with a conditional split layout:

```
<!-- Single mode (existing) -->
<div v-if="!splitNotes.isSplit.value" class="flex-1">
  <!-- existing editor dispatch -->
</div>

<!-- Split mode -->
<div v-else class="flex flex-1 min-h-0 overflow-hidden">
  <div class="split-pane left" :class="{ 'split-active': isLeftActive, 'split-passive': !isLeftActive }"
       @pointerdown="activateLeft">
    <!-- editor for leftNoteId -->
  </div>
  <div class="split-divider" /> <!-- 2-4px visual divider, optionally draggable later -->
  <div class="split-pane right" :class="{ 'split-active': isRightActive, 'split-passive': !isRightActive }"
       @pointerdown="activateRight">
    <!-- editor for rightNoteId -->
  </div>
</div>
```

**Active/Passive pane behavior**:
- Active pane: full interactivity, normal opacity, visible cursor
- Passive pane: `pointer-events: none` on the editor internals (Tiptap, Konva stage) BUT `pointer-events: auto` on the pane wrapper so `@pointerdown` can detect activation
- On `pointerdown` on passive pane: call `setActivePane()` → CSS transition smoothly swaps states (opacity, border highlight, `pointer-events`)
- Transition: `transition: opacity 0.2s ease, border-color 0.2s ease` — the active pane gets a subtle colored left/top border or ring

**Split pane header**: Each pane gets a small header bar with:
- Note title/preview (truncated)
- Close pane button (`X`)
- Swap sides button (↔)
- These are always interactive regardless of active/passive state

**Each pane renders its own editor** — this means two separate component instances. For CanvasNoteEditor, each gets its own `useCanvasViewport` and `useCanvasStageInteractions` instances (they're already instance-scoped).

**Depends on**: Phase 1 + Phase 2.

---

## Phase 4: Button/Context Menu Actions (Fallback)

**Modify**: `app/components/workspace/NotesSection.vue`

### 4a: Context menu action
Add to the existing `UContextMenu` items array for each drawer note:
```
{ label: 'Open in Split View', icon: 'i-lucide-columns-2', onSelect: () => splitNotes.openSplit(note.id, 'right') }
```
- Disabled if the note is already the primary or secondary in split
- Disabled if the note is the only note

### 4b: Toolbar button
Add a "Split View" toggle button in the notes header toolbar:
- Icon: `i-lucide-columns-2`
- Click: If not split → open split with the next note in the list on the right. If split → close split.
- Only visible when there are ≥2 notes

**Depends on**: Phase 1. *Parallel with* Phases 2 & 3.

---

## Phase 5: Fullscreen Split

**Modify**: `app/components/workspace/NotesSection.vue` — fullscreen section

When split mode is active and fullscreen is toggled:
- The `SharedFullscreenWrapper` gets wider: `max-width="95vw"` instead of `"900px"`
- Render the same split layout inside the fullscreen wrapper
- Both panes maintain their active/passive state
- The split state is independent of fullscreen (entering/exiting fullscreen doesn't change split)

The fullscreen toggle applies to the **entire notes section**, not individual panes. Both notes go fullscreen together.

**Depends on**: Phase 3.

---

## Phase 6: Edge Cases & Polish

- **Note deletion while in split**: If the deleted note is in a split pane, close that pane → fall back to single view with the surviving note
- **Same note in both panes**: Prevent opening the same note in both panes (disable in context menu, reject in `openSplit`)
- **Mobile**: Hide split drag handles on touch devices. Show only the context menu / button action. Split panes stack vertically on narrow screens (< 640px) or disable split entirely on mobile — TBD based on available width
- **Canvas pane passive mode**: For Konva canvas, passive mode means the stage is not draggable/interactive. Set `listening: false` on the Konva stage when passive. Re-enable on activation.
- **Tiptap passive mode**: Set `editable: false` on the Tiptap editor instance when passive. Toggle to `true` on activation.
- **Math note passive mode**: Disable stroke capture when passive.
- **localStorage cleanup**: Clear split state when workspace is deleted or notes are bulk-deleted.
- **Drawer selection highlight**: In split mode, highlight BOTH the primary and secondary notes in the drawer (different colors: primary = blue, secondary = green or a lighter shade).

**Depends on**: All previous phases.

---

## Relevant Files

- `app/composables/ui/useSplitNotes.ts` — **NEW** — core split state composable
- `app/components/workspace/NotesSplitDropZone.vue` — **NEW** — drop zone overlay component
- `app/components/workspace/NotesSection.vue` — **MODIFY** — integrate split layout, drag handles, drop zones, context menu, toolbar button, fullscreen changes
- `app/components/workspace/TextNote.vue` — **MINOR MODIFY** — accept `readonly` or `editable` prop for passive mode (check if already exists)
- `app/components/workspace/CanvasNoteEditor.vue` — **MINOR MODIFY** — accept `readonly` prop → set Konva stage `listening: false`
- `app/components/workspace/MathNoteEditor.vue` — **MINOR MODIFY** — accept `readonly` prop → disable stroke input
- `app/composables/ui/useFullscreenModal.ts` — **MINOR MODIFY** — support dynamic max-width for split fullscreen (or handle in NotesSection template)
- `shared/utils/note.contract.ts` — **NO CHANGE** — split is a pure UI concern, no schema changes

---

## Verification

1. **Reorder still works**: Drag note body in drawer → reorder (y-axis) completes without triggering split zones
2. **Drag-to-split works**: Drag split icon from drawer → drop on left/right zone → split view opens with correct note placement
3. **Context menu split**: Right-click note → "Open in Split View" → split opens
4. **Toolbar toggle**: Click split button → opens with next note; click again → closes
5. **Active/passive swap**: Click on passive pane → it becomes active smoothly (test with TEXT, MATH, CANVAS)
6. **Fullscreen split**: Toggle fullscreen while in split → both panes visible at 95vw; exit fullscreen → split persists
7. **Note deletion in split**: Delete the secondary note → split closes, primary remains
8. **Persistence**: Enter split → navigate away → come back → split state restored
9. **Same note guard**: Try to open same note in both panes → should be prevented
10. **Mobile**: On narrow viewport, split drag handles hidden; context menu action still works; layout graceful (stack or disable)

---

## Decisions

- **HTML5 DnD for split drag, motion-v for reorder**: Two completely separate drag systems to avoid conflicts. The `@pointerdown.stop` on the drag handle is the key separator.
- **Active/passive model (not dual-active)**: One pane editable, one read-only. Clicking the passive pane swaps instantly with a smooth CSS transition. This avoids focus/cursor conflicts between two Tiptap instances or two Konva stages.
- **Split is UI-only, no schema changes**: The note `order` field and all server contracts remain unchanged. Split state lives in localStorage per workspace.
- **Fullscreen expands for split**: 95vw max-width when split + fullscreen to give each pane room.

## Further Considerations

1. **Resizable split divider**: Should the divider between panes be draggable to resize? Recommend deferring to a follow-up — start with 50/50 split. The existing `useWorkspaceLayout` resize logic could be reused if needed later.
2. **Mobile split behavior**: Recommend disabling split on viewports < 640px (notes panel is already narrow). The button and context menu can show a toast "Split view requires a wider screen". Revisit if needed.

---
description: "Use when implementing canvas interactions, touch or pointer gestures, Konva stage behavior, canvas toolbar wiring, canvas viewport/minimap logic, fullscreen note editors, mobile drag conflicts, resize logic, or geometry helpers in canvas note files."
name: "Canvas Interaction Rules"
applyTo: "app/components/workspace/CanvasNoteEditor.vue, app/components/workspace/CanvasNoteToolbar.vue, app/components/workspace/MathNoteEditor.vue, app/components/workspace/NotesSection.vue, app/components/shared/Note*.vue, app/composables/ui/useCanvasViewport.ts, app/composables/ui/useCanvasStageInteractions.ts, app/utils/canvas/geometry.ts"
---

# Canvas Interaction Rules

- Canvas gestures and parent layout gestures are competing systems. On small screens, the active canvas interaction must win. Do not reintroduce parent swipe or drag navigation around canvas regions unless there is an explicit lock or arbitration mechanism.
- Keep pointer, touch, mouse, wheel, and fullscreen behavior aligned. If a new interaction is added for one input type, handle the touch/mobile equivalent or document why it is intentionally unsupported.
- Resize and fullscreen changes must preserve stage state where possible. Re-measure after the DOM settles instead of resetting scale, position, or selection eagerly.
- Respect the current canvas module boundaries. Keep toolbar rendering in `CanvasNoteToolbar.vue`, viewport/minimap and measurement logic in `useCanvasViewport.ts`, pointer/selection/drawing behavior in `useCanvasStageInteractions.ts`, and pure snap or bounds math in `app/utils/canvas/geometry.ts`.
- Persist through the notes pipeline only. Interaction changes must not bypass `useNotesStore`, `app/services/Note.ts`, or the shared note contracts.
- `CanvasShape` and `CanvasNoteMetadata` changes must be additive and backward-compatible. Do not introduce metadata that older saved notes cannot parse safely.
- Toolbar controls, destructive actions, and mode switches must stay explicit and tappable on mobile. Avoid hover-only affordances for canvas-critical controls.
- If you extract or rename canvas subcomponents, keep the editor-to-child wiring explicit and verify canvas-critical UI still renders. Do not assume implicit registration is safe for toolbar or overlay controls.
- When changing snapping, transforms, resize limits, or guide calculations, prefer updating the pure helpers in `app/utils/canvas/geometry.ts` instead of duplicating math inside components or composables.
- When changing viewport or minimap behavior, preserve existing camera state unless the user action is explicitly a reset or focus command.
- When changing touch or drag behavior, smoke-check at minimum: select mode, hand mode, draw mode, context menu, fullscreen toggle, autosave, and note switching from `NotesSection.vue`.
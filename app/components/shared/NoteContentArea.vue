<script setup lang="ts">
/**
 * NoteContentArea — shared content area wrapper used by all note editors.
 *
 * Enforces the gold-standard styling from MathNoteEditor:
 *   rounded corners, token border, inset shadow, token background, mx-2 spacing.
 *
 * Usage:
 *   <SharedNoteContentArea>
 *     <!-- your canvas / editor content here -->
 *   </SharedNoteContentArea>
 *
 * Extra classes (e.g. cursor-crosshair) can be passed via the `class` attribute —
 * they are automatically merged on the root element (default inheritAttrs behaviour).
 */
const rootEl = useTemplateRef<HTMLDivElement>('rootEl')
/** Expose the root DOM element so parents using template refs can call DOM APIs on it. */
defineExpose({ get el() { return rootEl.value } })
</script>

<template>
  <div ref="rootEl"
    class="relative rounded-[var(--radius-lg)] border border-secondary bg-background shadow-inner overflow-hidden transition-shadow duration-200 mx-2 flex-1 min-h-[300px]">
    <slot />
  </div>
</template>

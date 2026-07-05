<template>
  <div
    class="relative flex items-center gap-2 group w-full p-2.5 hover:bg-secondary"
    :class="[
      isSelected ? 'bg-primary/10 text-primary' : '',
      isFilteredOut ? 'opacity-50' : '',
      isPrimarySplit ? 'split-indicator-primary' : '',
      isSecondarySplit ? 'split-indicator-secondary' : '',
    ]"
  >
    <slot name="drag" :note="note" :display-title="displayTitle">
      <UiIconButton
        data-note-drag-handle
        icon="i-lucide-grip-vertical"
        :label="`Reorder or move ${displayTitle}`"
        size="xs"
        variant="ghost"
        tone="neutral"
        class="shrink-0 cursor-grab rounded-[var(--radius-md)] p-1 text-content-secondary opacity-60 hover:opacity-100 active:cursor-grabbing"
        @pointerdown.stop="emitIntent({ type: 'START_REORDER', noteId: note.id })"
        @click.stop
      />
    </slot>

    <div v-if="note.isLoading" class="flex items-center gap-1 text-primary">
      <icon name="i-lucide-loader" class="w-4 h-4 animate-spin" />
    </div>

    <slot name="title" :note="note" :display-title="displayTitle">
      <UiButton
        type="button"
        variant="link"
        tone="neutral"
        size="xs"
        class="min-w-0 flex-1 cursor-pointer truncate text-left"
        :aria-label="`Open ${displayTitle}`"
        @click.stop="emitIntent({ type: 'OPEN_NOTE', noteId: note.id })"
      >
        <ui-paragraph size="xs" class="truncate">
          <span v-if="note.noteType === 'CANVAS'" class="mr-1 text-warning-text">Canvas</span>
          <span v-else-if="note.noteType === 'MATH'" class="mr-1 text-primary">Math</span>
          {{ displayTitle }}
        </ui-paragraph>
      </UiButton>
    </slot>

    <div class="flex items-center gap-1 shrink-0">
      <span
        v-if="note.error"
        class="inline-flex items-center rounded-[var(--radius-md)] bg-error/10 px-1.5 py-0.5 text-[10px] font-medium text-error-text"
        title="Sync failed. Open the note to retry."
      >
        Retry
      </span>
      <span
        v-else-if="note.isDirty"
        class="inline-flex items-center rounded-[var(--radius-md)] bg-warning/10 px-1.5 py-0.5 text-[10px] font-medium text-warning-text"
        title="Saved locally and waiting to sync."
      >
        Local
      </span>

      <slot name="split" :note="note" :display-title="displayTitle">
        <UiIconButton
          v-if="canSplit"
          data-no-drag
          icon="i-lucide-columns-2"
          :label="`Open ${displayTitle} in split view`"
          size="xs"
          variant="ghost"
          tone="neutral"
          draggable="true"
          class="inline-flex h-7 w-7 items-center justify-center rounded-[var(--radius-lg)] text-content-secondary hover:bg-secondary hover:text-content-on-surface"
          @pointerdown.stop
          @dragstart.stop="handleSplitDragStart"
          @dragend.stop="handleSplitDragEnd"
          @click.stop="handleSplitClick"
        />
      </slot>

      <slot name="actions" :note="note" :display-title="displayTitle">
        <UiActionMenu
          data-no-drag
          :modal="false"
          :items="menuItems"
          size="xs"
          :label="`More actions for ${displayTitle}`"
          @pointerdown.stop
          @click.stop
        />
      </slot>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { NoteState } from "../composables/useNotesStore";
import type { NoteRowIntent } from "../composables/noteRowIntents";

const props = defineProps<{
  note: NoteState;
  displayTitle: string;
  isSelected: boolean;
  isFilteredOut: boolean;
  isPrimarySplit: boolean;
  isSecondarySplit: boolean;
  canSplit: boolean;
}>();

const emit = defineEmits<{
  intent: [intent: NoteRowIntent];
}>();

const suppressNextSplitClick = ref(false);

function emitIntent(intent: NoteRowIntent) {
  emit("intent", intent);
}

function handleSplitDragStart(event: DragEvent) {
  event.dataTransfer?.setData("text/note-id", props.note.id);
  event.dataTransfer?.setData("text/plain", props.note.id);
  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = "copy";
  }
  emitIntent({ type: "SPLIT_DRAG_START", noteId: props.note.id });
}

function handleSplitDragEnd() {
  suppressNextSplitClick.value = true;
  emitIntent({ type: "SPLIT_DRAG_END", noteId: props.note.id });
  window.setTimeout(() => {
    suppressNextSplitClick.value = false;
  }, 0);
}

function handleSplitClick() {
  if (suppressNextSplitClick.value) return;
  emitIntent({ type: "SPLIT_CLICK", noteId: props.note.id });
}

const menuItems = computed(() => [
  [
    {
      label: "Download as TXT",
      icon: "i-lucide-file-text",
      onSelect: () => emitIntent({ type: "ACTION", noteId: props.note.id, action: "download-txt" }),
    },
    {
      label: "Download as DOC",
      icon: "i-lucide-file",
      onSelect: () => emitIntent({ type: "ACTION", noteId: props.note.id, action: "download-doc" }),
    },
    {
      label: "Download as PDF",
      icon: "i-lucide-file",
      onSelect: () => emitIntent({ type: "ACTION", noteId: props.note.id, action: "download-pdf" }),
    },
    {
      id: `delete-${props.note.id}`,
      label: "Delete",
      icon: "i-lucide-trash-2",
      requiresDoubleTap: true,
      confirmLabel: "Tap again to delete",
      onSelect: () => emitIntent({ type: "ACTION", noteId: props.note.id, action: "delete" }),
    },
  ],
]);
</script>

<style scoped>
.split-indicator-primary {
  border-left: 2px solid var(--color-primary);
}

.split-indicator-secondary {
  border-left: 2px solid var(--color-success);
}
</style>

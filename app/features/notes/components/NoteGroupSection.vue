<template>
  <section class="border-b border-secondary last:border-b-0">
    <div
      class="flex items-center gap-2 bg-surface-subtle px-2 py-1.5"
    >
      <button
        v-if="!isUngrouped"
        type="button"
        data-group-drag-handle
        class="shrink-0 cursor-grab rounded p-1 text-content-secondary opacity-70 hover:opacity-100 active:cursor-grabbing"
        :aria-label="`Reorder group ${title}`"
        @click.stop
      >
        <icon name="i-lucide-grip-vertical" class="h-3.5 w-3.5" />
      </button>

      <u-button
        size="xs"
        color="neutral"
        variant="ghost"
        :aria-label="collapsed ? `Expand ${title}` : `Collapse ${title}`"
        @click="$emit('toggle-collapse', groupId)"
      >
        <icon :name="collapsed ? 'i-lucide-chevron-right' : 'i-lucide-chevron-down'" class="h-3.5 w-3.5" />
      </u-button>

      <button
        type="button"
        class="min-w-0 flex-1 truncate text-left text-xs font-semibold text-content-secondary"
        @click="$emit('toggle-collapse', groupId)"
      >
        {{ title }}
        <span class="font-normal opacity-70">({{ notes.length }})</span>
      </button>

      <u-button
        size="xs"
        color="neutral"
        variant="ghost"
        :aria-label="`Create note in ${title}`"
        @click.stop="$emit('create-note', groupId)"
      >
        <icon name="i-lucide-plus" class="h-3.5 w-3.5" />
      </u-button>

      <UDropdownMenu v-if="!isUngrouped" :modal="false" :items="groupMenuItems">
        <u-button
          size="xs"
          color="neutral"
          variant="ghost"
          :disabled="groupActionsDisabled"
          :aria-label="`Actions for group ${title}`"
        >
          <icon name="i-lucide-more-horizontal" class="h-3.5 w-3.5" />
        </u-button>
      </UDropdownMenu>
    </div>

    <div v-show="!collapsed" class="relative">
      <div
        ref="notesListRef"
        class="notes-drop-list bg-light"
        :class="{ 'notes-drop-list--empty': !dragNotes.length }"
      >
        <NoteRow
          v-for="note in dragNotes"
          :key="note.id"
          :note="note"
          :display-title="getNoteDisplayTitle(note, 30)"
          :is-selected="note.id === selectedNoteId"
          :is-filtered-out="filteredNoteIds ? !filteredNoteIds.has(note.id) : false"
          :is-primary-split="note.id === primarySplitNoteId && isSplit"
          :is-secondary-split="note.id === secondarySplitNoteId"
          :can-split="canSplit"
          @intent="handleRowIntent"
        />
      </div>
      <div
        v-if="!dragNotes.length"
        class="pointer-events-none absolute inset-0 flex items-center px-3 text-xs text-content-secondary"
      >
        Drop notes here
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { useDragAndDrop } from "@formkit/drag-and-drop/vue";
import type { NoteState } from "../composables/useNotesStore";
import type { NoteRowIntent } from "../composables/noteRowIntents";
import NoteRow from "./NoteRow.vue";

const props = defineProps<{
  groupId: string | null;
  title: string;
  notes: NoteState[];
  collapsed: boolean;
  selectedNoteId: string | null;
  filteredNoteIds: Set<string> | null;
  primarySplitNoteId: string | null;
  secondarySplitNoteId: string | null;
  isSplit: boolean;
  canSplit: boolean;
  groupActionsDisabled: boolean;
  getNoteDisplayTitle: (note?: NoteState | null, maxLength?: number) => string;
}>();

const isUngrouped = computed(() => props.groupId === null);
const isApplyingExternalNotes = ref(false);
const isUserDraggingNotes = ref(false);

const [notesListRef, dragNotes] = useDragAndDrop<NoteState>([], {
  group: "workspace-notes",
  dragHandle: "[data-note-drag-handle]",
  draggingClass: "note-row--dragging",
  dragPlaceholderClass: "note-row--placeholder",
  dropZoneClass: "note-row--drop-target",
  dropZoneParentClass: "notes-drop-list--target",
  synthDraggingClass: "note-row--dragging",
  synthDragPlaceholderClass: "note-row--placeholder",
  synthDropZoneClass: "note-row--drop-target",
  synthDropZoneParentClass: "notes-drop-list--target",
  dropZone: true,
  longPress: true,
  longPressDuration: 180,
  onDragstart: () => {
    console.log(`🔍 [TRACE:REORDER] NoteGroupSection onDragstart`, { groupId: props.groupId });
    isUserDraggingNotes.value = true;
    emit("drag-start", props.groupId);
  },
  onDragend: () => {
    console.log(`🔍 [TRACE:REORDER] NoteGroupSection onDragend`, { groupId: props.groupId, isUserDraggingNotes: isUserDraggingNotes.value });
    emit("drag-end", props.groupId);
    requestAnimationFrame(() => {
      isUserDraggingNotes.value = false;
      console.log(`🔍 [TRACE:REORDER] NoteGroupSection onDragend RAF — isUserDraggingNotes set to false`);
    });
  },
  onSort: () => { console.log(`🔍 [TRACE:REORDER] NoteGroupSection onSort`, { groupId: props.groupId }); emitUserNoteLayout(); },
  onTransfer: () => { console.log(`🔍 [TRACE:REORDER] NoteGroupSection onTransfer`, { groupId: props.groupId }); emitUserNoteLayout(true); },
});

watch(
  () => props.notes.map((note) => `${note.id}:${note.groupId ?? "ungrouped"}:${note.order}`).join("|"),
  async () => {
    isApplyingExternalNotes.value = true;
    dragNotes.value = props.notes.slice();
    await nextTick();
    isApplyingExternalNotes.value = false;
  },
  { immediate: true },
);

const groupMenuItems = computed(() => [
  [
    {
      label: "Rename group",
      icon: "i-lucide-pencil",
      disabled: props.groupActionsDisabled,
      onSelect: () => props.groupId && emitRename(props.groupId),
    },
    {
      label: "Delete group",
      icon: "i-lucide-trash-2",
      disabled: props.groupActionsDisabled,
      onSelect: () => props.groupId && emitDelete(props.groupId),
    },
  ],
]);

const emit = defineEmits<{
  "toggle-collapse": [groupId: string | null];
  "rename-group": [groupId: string];
  "delete-group": [groupId: string];
  "create-note": [groupId: string | null];
  "notes-reordered": [groupId: string | null, noteIds: string[]];
  "drag-start": [groupId: string | null];
  "drag-end": [groupId: string | null];
  "row-intent": [intent: NoteRowIntent];
}>();

function emitRename(groupId: string) {
  emit("rename-group", groupId);
}

function emitDelete(groupId: string) {
  emit("delete-group", groupId);
}

function emitUserNoteLayout(force = false) {
  // Capture drag state synchronously — by the time nextTick fires,
  // onDragend's requestAnimationFrame may have reset the flag.
  const wasDragging = isUserDraggingNotes.value;
  console.log(`🔍 [TRACE:REORDER] emitUserNoteLayout called`, { force, wasDragging, isApplyingExternal: isApplyingExternalNotes.value, groupId: props.groupId });
  if (isApplyingExternalNotes.value || (!force && !wasDragging)) {
    console.log(`🔍 [TRACE:REORDER] emitUserNoteLayout SUPPRESSED`, { isApplyingExternal: isApplyingExternalNotes.value, force, wasDragging });
    return;
  }
  nextTick(() => {
    if (isApplyingExternalNotes.value) {
      console.log(`🔍 [TRACE:REORDER] emitUserNoteLayout nextTick SUPPRESSED — isApplyingExternalNotes`);
      return;
    }
    const noteIds = dragNotes.value.map((note) => note.id);
    console.log(`🔍 [TRACE:REORDER] emitUserNoteLayout EMITTING notes-reordered`, { groupId: props.groupId, noteIds });
    emit("notes-reordered", props.groupId, noteIds);
  });
}

function handleRowIntent(intent: NoteRowIntent) {
  emit("row-intent", intent);
}
</script>

<style scoped>
.notes-drop-list {
  min-height: 2.75rem;
}

.notes-drop-list--empty {
  border: 1px dashed rgba(99, 102, 241, 0.25);
}

:deep(.notes-drop-list--target) {
  background: rgba(238, 242, 255, 0.75);
  outline: 1px dashed rgba(99, 102, 241, 0.7);
  outline-offset: -2px;
}

:deep(.note-row--dragging) {
  box-shadow: 0 10px 30px rgb(15 23 42 / 0.16);
  opacity: 0.92;
  transform: scale(1.01);
}

:deep(.note-row--placeholder) {
  background: rgba(238, 242, 255, 0.9);
  border: 1px dashed rgba(99, 102, 241, 0.75);
}

:deep(.note-row--drop-target) {
  border-top: 2px solid rgb(99 102 241);
}
</style>

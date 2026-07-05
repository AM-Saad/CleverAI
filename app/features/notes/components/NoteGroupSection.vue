<template>
  <section class="border-b border-secondary last:border-b-0">
    <div
      class="flex items-center gap-2 bg-surface-subtle px-2 py-1.5"
    >
      <UiIconButton
        v-if="!isUngrouped"
        data-group-drag-handle
        icon="i-lucide-grip-vertical"
        :label="`Reorder group ${title}`"
        size="xs"
        variant="ghost"
        tone="neutral"
        class="shrink-0 cursor-grab rounded-[var(--radius-md)] p-1 text-content-secondary opacity-70 hover:opacity-100 active:cursor-grabbing"
        @click.stop
      />

      <UiIconButton
        size="xs"
        tone="neutral"
        variant="ghost"
        :icon="collapsed ? 'i-lucide-chevron-right' : 'i-lucide-chevron-down'"
        :label="collapsed ? `Expand ${title}` : `Collapse ${title}`"
        @click="$emit('toggle-collapse', groupId)"
      />

      <UiButton
        v-if="!editing"
        type="button"
        variant="link"
        tone="neutral"
        size="xs"
        dir="auto"
        class="min-w-0 flex-1 truncate text-left text-xs font-semibold text-content-secondary"
        @click="$emit('toggle-collapse', groupId)"
      >
        {{ title }}
        <span class="font-normal opacity-70">({{ notes.length }})</span>
      </UiButton>

      <form
        v-else
        class="flex min-w-0 flex-1 items-center gap-1"
        @submit.prevent="groupId && $emit('submit-rename-group', groupId)"
      >
        <UiInput
          :model-value="editingTitle"
          :data-note-group-rename-input="groupId"
          size="xs"
          dir="auto"
          class="min-w-0 flex-1"
          @update:model-value="$emit('update:editing-title', String($event ?? ''))"
          @keydown.esc.prevent="$emit('cancel-rename-group')"
        />
        <UiButton
          size="xs"
          tone="primary"
          variant="solid"
          type="submit"
          :disabled="!editingTitle.trim()"
        >
          Save
        </UiButton>
        <UiButton
          size="xs"
          tone="neutral"
          variant="ghost"
          type="button"
          @click="$emit('cancel-rename-group')"
        >
          Cancel
        </UiButton>
      </form>

      <UiIconButton
        v-if="!editing"
        size="xs"
        tone="neutral"
        variant="ghost"
        icon="i-lucide-plus"
        :label="`Create note in ${title}`"
        @click.stop="$emit('create-note', groupId)"
      />

      <UiActionMenu
        v-if="!isUngrouped && !editing"
        :modal="false"
        :items="groupMenuItems"
        size="xs"
        :disabled="groupActionsDisabled"
        :label="`Actions for group ${title}`"
      />
    </div>

    <div v-show="!collapsed" class="relative">
      <div
        ref="notesListRef"
        class="notes-drop-list bg-light"
        :class="{ 'notes-drop-list--empty': !dragNoteRows.length }"
      >
        <NoteRow
          v-for="note in dragNoteRows"
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
        v-if="!dragNoteRows.length"
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
  editing: boolean;
  editingTitle: string;
  getNoteDisplayTitle: (note?: NoteState | null, maxLength?: number) => string;
}>();

const isUngrouped = computed(() => props.groupId === null);
const isApplyingExternalNotes = ref(false);
const isUserDraggingNotes = ref(false);

const [notesListRef, dragNoteIds] = useDragAndDrop<string>([], {
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
    isUserDraggingNotes.value = true;
    emit("drag-start", props.groupId);
  },
  onDragend: () => {
    emit("drag-end", props.groupId);
    requestAnimationFrame(() => {
      isUserDraggingNotes.value = false;
    });
  },
  onSort: () => emitUserNoteLayout(),
  onTransfer: () => emitUserNoteLayout(true),
});

watch(
  () => props.notes
    .map((note) => `${note.id}:${note.groupId ?? "ungrouped"}:${note.order}`)
    .join("|"),
  async () => {
    if (isUserDraggingNotes.value) return;
    isApplyingExternalNotes.value = true;
    dragNoteIds.value = props.notes.map((note) => note.id);
    await nextTick();
    isApplyingExternalNotes.value = false;
  },
  { immediate: true },
);

const noteById = computed(() => new Map(props.notes.map((note) => [note.id, note])));
const dragNoteRows = computed(() =>
  dragNoteIds.value
    .map((id) => noteById.value.get(id))
    .filter((note): note is NoteState => Boolean(note)),
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
      id: `delete-group-${props.groupId}`,
      label: "Delete group",
      icon: "i-lucide-trash-2",
      disabled: props.groupActionsDisabled,
      requiresDoubleTap: true,
      confirmLabel: "Tap again to delete group",
      onSelect: () => props.groupId && emitDelete(props.groupId),
    },
  ],
]);

const emit = defineEmits<{
  "toggle-collapse": [groupId: string | null];
  "rename-group": [groupId: string];
  "delete-group": [groupId: string];
  "update:editing-title": [title: string];
  "submit-rename-group": [groupId: string];
  "cancel-rename-group": [];
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
  if (isApplyingExternalNotes.value || (!force && !wasDragging)) {
    return;
  }
  nextTick(() => {
    if (isApplyingExternalNotes.value) {
      return;
    }
    emit("notes-reordered", props.groupId, dragNoteIds.value.slice());
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
  border: 1px dashed color-mix(in srgb, var(--color-accent-indigo) 25%, transparent);
}

:deep(.notes-drop-list--target) {
  background: color-mix(in srgb, var(--color-accent-indigo) 10%, var(--color-surface));
  outline: 1px dashed color-mix(in srgb, var(--color-accent-indigo) 70%, transparent);
  outline-offset: -2px;
}

:deep(.note-row--dragging) {
  box-shadow: 0 10px 30px color-mix(in srgb, var(--color-content-on-background) 16%, transparent);
  opacity: 0.92;
  transform: scale(1.01);
}

:deep(.note-row--placeholder) {
  background: color-mix(in srgb, var(--color-accent-indigo) 12%, var(--color-surface));
  border: 1px dashed color-mix(in srgb, var(--color-accent-indigo) 75%, transparent);
}

:deep(.note-row--drop-target) {
  border-top: 2px solid var(--color-accent-indigo);
}
</style>

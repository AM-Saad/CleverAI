<template>
  <div class="notes-drawer flex h-full min-h-0 flex-col rounded border border-secondary bg-light">
    <div class="border-b border-secondary p-2">
      <NotesSearch :workspace-id="workspaceId" />
      <div class="mt-2 flex items-center justify-between gap-2">
        <p class="text-xs text-content-secondary">
          {{ notes.length }} notes
        </p>
        <u-button
          size="xs"
          color="neutral"
          variant="soft"
          :disabled="groupActionsDisabled"
          :title="groupActionsDisabled ? 'Group management is available online.' : 'Create group'"
          @click="promptCreateGroup"
        >
          <icon name="i-lucide-folder-plus" class="h-3.5 w-3.5" />
          Group
        </u-button>
      </div>
      <p v-if="groupActionsDisabled" class="mt-1 text-[11px] text-content-secondary">
        Group create, rename, and delete are available online. Reorder works locally.
      </p>
    </div>

    <div class="min-h-0 flex-1 overflow-auto">
      <div ref="groupListRef">
        <NoteGroupSection
          v-for="section in dragGroupSections"
          :key="section.key"
          :group-id="section.groupId"
          :title="section.title"
          :notes="section.notes"
          :collapsed="isGroupCollapsed(section.groupId)"
          :selected-note-id="selectedNoteId"
          :filtered-note-ids="filteredNoteIds"
          :primary-split-note-id="primarySplitNoteId"
          :secondary-split-note-id="secondarySplitNoteId"
          :is-split="isSplit"
          :can-split="canSplit"
          :group-actions-disabled="groupActionsDisabled"
          :get-note-display-title="getNoteDisplayTitle"
          @toggle-collapse="$emit('toggle-group-collapse', $event)"
          @create-note="$emit('create-note', $event)"
          @rename-group="promptRenameGroup"
          @delete-group="promptDeleteGroup"
          @notes-reordered="handleSectionNotesReordered"
          @drag-start="handleNoteDragStart"
          @drag-end="handleNoteDragEnd"
          @row-intent="handleRowIntent"
        />
      </div>

      <NoteGroupSection
        :key="ungroupedSection.key"
        :group-id="ungroupedSection.groupId"
        :title="ungroupedSection.title"
        :notes="ungroupedSection.notes"
        :collapsed="isGroupCollapsed(ungroupedSection.groupId)"
        :selected-note-id="selectedNoteId"
        :filtered-note-ids="filteredNoteIds"
        :primary-split-note-id="primarySplitNoteId"
        :secondary-split-note-id="secondarySplitNoteId"
        :is-split="isSplit"
        :can-split="canSplit"
        :group-actions-disabled="groupActionsDisabled"
        :get-note-display-title="getNoteDisplayTitle"
        @toggle-collapse="$emit('toggle-group-collapse', $event)"
        @create-note="$emit('create-note', $event)"
        @notes-reordered="handleSectionNotesReordered"
        @drag-start="handleNoteDragStart"
        @drag-end="handleNoteDragEnd"
        @row-intent="handleRowIntent"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { useDragAndDrop } from "@formkit/drag-and-drop/vue";
import type { NoteGroup } from "@@/shared/utils/note-group.contract";
import type { NoteLayoutItem } from "@@/shared/utils/note-sync.contract";
import type { NoteState } from "../composables/useNotesStore";
import type { NoteRowIntent } from "../composables/noteRowIntents";
import { logNotesOperation } from "../composables/notesOperationLog";
import NoteGroupSection from "./NoteGroupSection.vue";
import NotesSearch from "./NotesSearch.vue";

const props = defineProps<{
  workspaceId: string;
  notes: NoteState[];
  groups: NoteGroup[];
  selectedNoteId: string | null;
  filteredNoteIds: Set<string> | null;
  isVerifiedOnline: boolean;
  primarySplitNoteId: string | null;
  secondarySplitNoteId: string | null;
  isSplit: boolean;
  canSplit: boolean;
  isGroupCollapsed: (id: string | null) => boolean;
  getNoteDisplayTitle: (note?: NoteState | null, maxLength?: number) => string;
}>();

const emit = defineEmits<{
  "select-note": [noteId: string];
  "create-note": [groupId: string | null];
  "create-group": [title: string];
  "rename-group": [groupId: string, title: string];
  "delete-group": [groupId: string];
  "reorder-groups": [groups: NoteGroup[]];
  "layout-notes-changed": [notes: NoteLayoutItem[]];
  "delete-note": [noteId: string];
  "split-note": [noteId: string];
  "split-note-drag-start": [noteId: string];
  "split-note-drag-end": [noteId: string];
  "download-note": [noteId: string, format: "txt" | "doc" | "pdf"];
  "toggle-group-collapse": [groupId: string | null];
}>();

interface DrawerSection {
  key: string;
  groupId: string | null;
  title: string;
  notes: NoteState[];
}

const isApplyingExternalGroups = ref(false);
const isUserDraggingGroups = ref(false);
const sectionNoteState = ref<Map<string, string[]>>(new Map());
let sectionCommitTimer: ReturnType<typeof setTimeout> | null = null;
let lastCommittedLayoutSignature = "";

const groupActionsDisabled = computed(() => !props.isVerifiedOnline);

const sortedNotesForGroup = (groupId: string | null) =>
  props.notes
    .filter((note) => (note.groupId ?? null) === groupId)
    .sort((a, b) => a.order - b.order);

const groupSections = computed<DrawerSection[]>(() =>
  props.groups
    .slice()
    .sort((a, b) => a.order - b.order)
    .map((group) => ({
      key: group.id,
      groupId: group.id,
      title: group.title,
      notes: sortedNotesForGroup(group.id),
    })),
);

const ungroupedSection = computed<DrawerSection>(() => ({
  key: "__ungrouped__",
  groupId: null,
  title: "Ungrouped",
  notes: sortedNotesForGroup(null),
}));

const [groupListRef, dragGroupSections] = useDragAndDrop<DrawerSection>([], {
  sortable: true,
  dragHandle: "[data-group-drag-handle]",
  draggingClass: "note-group--dragging",
  dragPlaceholderClass: "note-group--placeholder",
  dropZoneClass: "note-group--drop-target",
  longPress: true,
  longPressDuration: 180,
  draggableValue: (section) => section.groupId !== null,
  onDragstart: () => {
    isUserDraggingGroups.value = true;
  },
  onDragend: () => {
    emitUserGroupOrder();
    requestAnimationFrame(() => {
      isUserDraggingGroups.value = false;
    });
  },
});

watch(
  () => groupSections.value.map((section) => `${section.groupId}:${section.title}`).join("|"),
  async () => {
    isApplyingExternalGroups.value = true;
    dragGroupSections.value = groupSections.value.slice();
    await nextTick();
    isApplyingExternalGroups.value = false;
  },
  { immediate: true },
);

watch(
  () => props.notes.map((note) => `${note.id}:${note.groupId ?? "ungrouped"}:${note.order}`).join("|"),
  () => {
    const nextState = new Map<string, string[]>();
    groupSections.value.forEach((section) =>
      nextState.set(section.key, section.notes.map((note) => note.id)),
    );
    nextState.set(
      ungroupedSection.value.key,
      ungroupedSection.value.notes.map((note) => note.id),
    );
    sectionNoteState.value = nextState;
  },
  { immediate: true },
);

function promptCreateGroup() {
  if (groupActionsDisabled.value || typeof window === "undefined") return;
  const title = window.prompt("Group name");
  const trimmed = title?.trim();
  if (!trimmed) return;
  emit("create-group", trimmed);
}

function promptRenameGroup(groupId: string) {
  if (groupActionsDisabled.value || typeof window === "undefined") return;
  const current = props.groups.find((group) => group.id === groupId);
  const title = window.prompt("Rename group", current?.title ?? "");
  const trimmed = title?.trim();
  if (!trimmed || trimmed === current?.title) return;
  emit("rename-group", groupId, trimmed);
}

function promptDeleteGroup(groupId: string) {
  if (groupActionsDisabled.value || typeof window === "undefined") return;
  const current = props.groups.find((group) => group.id === groupId);
  const ok = window.confirm(`Delete "${current?.title ?? "group"}"? Notes will move to Ungrouped.`);
  if (!ok) return;
  emit("delete-group", groupId);
}

function sectionKey(groupId: string | null) {
  return groupId ?? "__ungrouped__";
}

function currentLayoutSignature() {
  const orderedSections = [...dragGroupSections.value, ungroupedSection.value];
  return orderedSections
    .flatMap((section) => {
      const sectionNotes =
        sectionNoteState.value.get(section.key) ?? section.notes.map((note) => note.id);
      return sectionNotes.map((noteId, order) => `${noteId}:${section.groupId ?? "ungrouped"}:${order}`);
    })
    .join("|");
}

function emitUserGroupOrder() {
  // Capture drag state synchronously — by the time nextTick fires,
  // onDragend's requestAnimationFrame may have reset the flag.
  const wasDragging = isUserDraggingGroups.value;
  if (isApplyingExternalGroups.value || !wasDragging) return;
  nextTick(() => {
    if (isApplyingExternalGroups.value) return;
    const reordered = dragGroupSections.value
      .map((section, index) => {
        const group = props.groups.find((item) => item.id === section.groupId);
        return group ? { ...group, order: index } : null;
      })
      .filter((group): group is NoteGroup => group !== null);

    if (reordered.length) emit("reorder-groups", reordered);
  });
}

const isDraggingNote = ref(false);

function handleNoteDragStart(groupId: string | null) {
  isDraggingNote.value = true;
  logNotesOperation("drag-start", { workspaceId: props.workspaceId, groupId });
}

function handleNoteDragEnd(groupId: string | null) {
  console.log(`🔍 [TRACE:REORDER] NotesDrawer handleNoteDragEnd`, { groupId });
  isDraggingNote.value = false;
  commitSectionNotes();
}

function handleRowIntent(intent: NoteRowIntent) {
  if (intent.type === "OPEN_NOTE") {
    logNotesOperation("select", { workspaceId: props.workspaceId, noteId: intent.noteId });
    emit("select-note", intent.noteId);
    return;
  }

  if (intent.type === "START_REORDER") {
    logNotesOperation("drag-start", { workspaceId: props.workspaceId, noteId: intent.noteId });
    return;
  }

  if (intent.type === "SPLIT_CLICK") {
    logNotesOperation("split", { workspaceId: props.workspaceId, noteId: intent.noteId });
    emit("split-note", intent.noteId);
    return;
  }

  if (intent.type === "SPLIT_DRAG_START") {
    logNotesOperation("split", {
      workspaceId: props.workspaceId,
      noteId: intent.noteId,
      interaction: "drag-start",
    });
    emit("split-note-drag-start", intent.noteId);
    return;
  }

  if (intent.type === "SPLIT_DRAG_END") {
    emit("split-note-drag-end", intent.noteId);
    return;
  }

  if (intent.action === "delete") {
    emit("delete-note", intent.noteId);
    return;
  }

  const format = intent.action.replace("download-", "") as "txt" | "doc" | "pdf";
  emit("download-note", intent.noteId, format);
}

function commitSectionNotes() {
  const signature = currentLayoutSignature();
  if (signature === lastCommittedLayoutSignature) {
    console.log(`🔍 [TRACE:REORDER] NotesDrawer commit SKIPPED — signature unchanged`);
    return;
  }
  lastCommittedLayoutSignature = signature;

  const orderedNotes: NoteLayoutItem[] = [];
  const orderedSections = [...dragGroupSections.value, ungroupedSection.value];
  for (const section of orderedSections) {
    const sectionNotes =
      sectionNoteState.value.get(section.key) ?? section.notes.map((note) => note.id);
    sectionNotes.forEach((noteId, order) => {
      orderedNotes.push({
        id: noteId,
        groupId: section.groupId,
        order,
      });
    });
  }
  console.log(`🔍 [TRACE:REORDER] NotesDrawer EMITTING layout-notes-changed`, { count: orderedNotes.length, notes: orderedNotes });
  emit("layout-notes-changed", orderedNotes);
}

function handleSectionNotesReordered(groupId: string | null, noteIds: string[]) {
  console.log(`🔍 [TRACE:REORDER] NotesDrawer handleSectionNotesReordered`, { groupId, noteIds });
  const nextState = new Map(sectionNoteState.value);
  nextState.set(sectionKey(groupId), noteIds);
  sectionNoteState.value = nextState;

  if (!isDraggingNote.value) {
    if (sectionCommitTimer) clearTimeout(sectionCommitTimer);
    sectionCommitTimer = setTimeout(() => {
      commitSectionNotes();
    }, 0);
  }
}
</script>

<style scoped>
:deep(.note-group--dragging) {
  box-shadow: 0 14px 40px rgb(15 23 42 / 0.14);
  opacity: 0.96;
}

:deep(.note-group--placeholder),
:deep(.note-group--drop-target) {
  background: rgba(238, 242, 255, 0.9);
  outline: 1px dashed rgba(99, 102, 241, 0.75);
  outline-offset: -2px;
}
</style>

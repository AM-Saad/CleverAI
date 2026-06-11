<template>
  <!-- Parent container -->
  <div ref="noteRef" :class="noteContainerClasses">
    <!-- Toolbar sits above the styled content area (matches math/canvas note pattern) -->
    <SharedNoteToolbar v-if="!isBoardItem" :is-loading="note.isLoading" :is-fullscreen="isFullscreen"
      :readonly="props.readonly" @toggleFullscreen="handleToggleFullscreen" @delete="deleteNote(note.id)">
      <!-- Plug in the editor tools for Tiptap -->
      <shared-tiptap-toolbar v-if="tiptapEditor" :editor="tiptapEditor" />

      <span class="px-2 text-[11px] font-medium text-content-secondary">
        {{ saveStateText }}
      </span>

      <UDropdownMenu :modal="false" :items="[
        [
          { label: 'Download as TXT', icon: 'i-heroicons-document-text', onSelect: () => exportContent('Note', note.content, 'txt') },
          { label: 'Download as DOC', icon: 'i-heroicons-document', onSelect: () => exportContent('Note', note.content, 'doc') },
          { label: 'Download as PDF', icon: 'i-heroicons-document', onSelect: () => exportContent('Note', note.content, 'pdf') }
        ]
      ]">
        <u-button variant="outline" color="primary" size="sm">
          <shared-icon name="download" class="w-4 h-4" />
        </u-button>
      </UDropdownMenu>
    </SharedNoteToolbar>

    <!-- Content area — styled via shared NoteContentArea component -->
    <SharedNoteContentArea :class="{ 'flex-col': true }">
      <!-- Error state -->
      <div v-if="note.error" class="flex flex-col items-center justify-center h-full text-error p-4">
        <svg class="w-6 h-6 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
            d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <span class="text-sm font-medium text-center">{{ note.error }}</span>
        <UButton v-if="!isConflictError" variant="ghost" color="error" size="xs" class="mt-2 underline" @click="retry">
          Try again
        </UButton>
        <div v-else class="mt-4 w-full max-w-2xl rounded border border-warning/30 bg-warning/5 p-3 text-content-on-surface">
          <div class="grid gap-3 md:grid-cols-2">
            <div class="min-w-0">
              <div class="mb-1 text-xs font-semibold text-warning">Local draft</div>
              <div class="max-h-32 overflow-auto rounded bg-surface p-2 text-xs text-content-secondary">
                {{ localConflictPreview }}
              </div>
            </div>
            <div class="min-w-0">
              <div class="mb-1 text-xs font-semibold text-warning">Server version</div>
              <div class="max-h-32 overflow-auto rounded bg-surface p-2 text-xs text-content-secondary">
                {{ serverConflictPreview }}
              </div>
            </div>
          </div>
          <div class="mt-3 flex flex-wrap justify-center gap-2">
            <UButton size="xs" color="warning" variant="soft" @click="resolveConflict('keep-local')">
              Keep mine
            </UButton>
            <UButton size="xs" color="neutral" variant="soft" @click="resolveConflict('keep-server')">
              Use server
            </UButton>
            <UButton size="xs" color="primary" variant="soft" @click="resolveConflict('manual-merge')">
              Edit local copy
            </UButton>
          </div>
        </div>
      </div>

      <!-- Editor -->
      <client-only>
        <div ref="editorContainerRef" class="h-full flex-1 min-h-0 shrink-0">
          <shared-tiptap-editor ref="tiptapRef" :key="editorKey" :id="note.id" v-model="contentHtml" :isFullScreen="isFullscreen"
            :readonly="editorReadonly" :document-mode="props.isBoardItem ? 'default' : 'workspace-note'"
            :collaboration="collaborationConfig"
            @addToMaterial="handleAddToMaterial" @blur="flushPendingSave"
            @collaboration-status="handleCollaborationStatus" />
        </div>
      </client-only>
    </SharedNoteContentArea>
  </div>
</template>

<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, watch } from "vue";
import { normalizeWorkspaceNoteContent } from "@@/shared/utils/workspaceNote";
import { useExportContent } from "~/composables/shared/useExportContent";
import { useDebounce } from "~/utils/debounce";
import type { NoteSyncConflictRecord } from "~/utils/idb";
import {
  buildWorkspaceTextDraftCommit,
  resolveEditorSaveState,
  saveStateLabel,
} from "../composables/notesDraftCommitter";
import { registerNotesDraftFlusher } from "../composables/notesEditorRuntimeState";
import { useNotesCollaborationStatus } from "../composables/notesCollaborationStatus";
import type { NoteCollabTokenResponse } from "@@/shared/utils/note-collab.contract";

interface NoteOrBoardItem {
  id: string;
  workspaceId?: string | null;
  title?: string;
  content: string;
  noteType?: string | null;
  isLoading?: boolean;
  error?: string | null;
}

interface WorkspaceNoteUpdatePayload {
  title: string;
  content: string;
}

interface Props {
  note: NoteOrBoardItem;
  placeholder?: string;
  size?: "sm" | "md" | "lg";
  isFullscreen?: boolean;
  deleteNote: (id: string) => void;
  isBoardItem?: boolean;
  /** When true, renders read-only (passive pane in split view) */
  readonly?: boolean;
  conflict?: NoteSyncConflictRecord | null;
}

const props = withDefaults(defineProps<Props>(), {
  placeholder: "Double-click to add a note...",
  size: "md",
  isFullscreen: false,
  isBoardItem: false,
  readonly: false,
});

const emit = defineEmits<{
  update: [id: string, payload: string | WorkspaceNoteUpdatePayload];
  "draft-update": [id: string, payload: WorkspaceNoteUpdatePayload];
  retry: [id: string];
  "resolve-conflict": [id: string, resolution: "keep-local" | "keep-server" | "manual-merge"];
  'toggle-fullscreen': [id: string];
  addToMaterial: [selectedText: string];
}>();

// Reactive state
const isEditing = ref(true);
const normalizeEditorValue = (value: string) => (
  props.isBoardItem ? sanitizeHtml(value) : normalizeWorkspaceNoteContent(sanitizeHtml(value))
);

const emitUpdate = (noteId: string, content: string) => {
  if (props.isBoardItem) {
    emit("update", noteId, content);
    return;
  }

  emit("update", noteId, buildWorkspaceTextDraftCommit(content));
};

const emitDraftUpdate = () => {
  if (props.isBoardItem || editorReadonly.value) return;
  if (draftFrame !== null) return;

  draftFrame = window.requestAnimationFrame(() => {
    draftFrame = null;
    const normalized = normalizeEditorValue(contentHtml.value);
    const draft = buildWorkspaceTextDraftCommit(normalized);
    const signature = `${draft.title}\n${draft.content}`;
    if (signature === lastDraftSignature.value) return;
    lastDraftSignature.value = signature;
    emit("draft-update", draftNoteId.value, draft);
  });
};

const contentHtml = ref(normalizeEditorValue(props.note.content)); // HTML content for tiptap v-model
const lastCommittedContent = ref(normalizeEditorValue(props.note.content)); // To track changes for saving
const draftNoteId = ref(props.note.id);
const hasLocalDraft = ref(false);
const isApplyingExternalContent = ref(false);
const lastDraftSignature = ref("");
const collabToken = ref<NoteCollabTokenResponse | null>(null);
let draftFrame: number | null = null;

// Template ref bridging
const tiptapRef = ref<{ editor: any } | null>(null);
const tiptapEditor = computed(() => tiptapRef.value?.editor);

const { exportContent } = useExportContent();
const { $api } = useNuxtApp();
const runtimeConfig = useRuntimeConfig();
const collaborationStatus = useNotesCollaborationStatus();
const { debouncedFunc: scheduleSave, flush: flushScheduledSave } = useDebounce(
  () => {
    commitDraft();
  },
  700,
);
const { debouncedFunc: scheduleCollaborationSnapshot, flush: flushCollaborationSnapshot } = useDebounce(
  () => {
    void saveCollaborationSnapshot();
  },
  1200,
);

const collaborationEligible = computed(() =>
  Boolean(
    runtimeConfig.public.notesCollabEnabled &&
    !props.isBoardItem &&
    props.note.workspaceId &&
    props.note.noteType !== "MATH" &&
    props.note.noteType !== "CANVAS" &&
    !props.note.id.startsWith("temp-"),
  ),
);

const collaborationConfig = computed(() => {
  if (!collaborationEligible.value || !collabToken.value) {
    return { enabled: false };
  }
  const workspaceId = props.note.workspaceId;
  if (!workspaceId) return { enabled: false };

  return {
    enabled: true,
    workspaceId,
    noteId: props.note.id,
    roomName: collabToken.value.roomName,
    token: collabToken.value.token,
    websocketUrl: collabToken.value.websocketUrl,
    bootstrapContent: normalizeEditorValue(props.note.content),
  };
});

const editorKey = computed(() =>
  collaborationConfig.value.enabled
    ? `${props.note.id}:collab:${collabToken.value?.roomName ?? "pending"}`
    : `${props.note.id}:local`,
);

const saveState = computed(() =>
  resolveEditorSaveState({
    hasLocalDraft: hasLocalDraft.value,
    isDirty: "isDirty" in props.note ? Boolean((props.note as any).isDirty) : false,
    isLoading: props.note.isLoading,
    error: props.note.error,
  }),
);
const saveStateText = computed(() => saveStateLabel(saveState.value));
const isConflictError = computed(() =>
  Boolean(props.note.error?.includes("Sync conflict detected")),
);
const editorReadonly = computed(() => props.readonly || isConflictError.value);

const toPlainPreview = (value: unknown) => {
  if (typeof value !== "string" || !value.trim()) return "No content";
  return value
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 700) || "No content";
};

const localConflictPreview = computed(() => {
  const local = props.conflict?.localSnapshot as { content?: unknown } | null | undefined;
  return toPlainPreview(local?.content ?? props.note.content);
});
const serverConflictPreview = computed(() => {
  const server = props.conflict?.serverSnapshot as { content?: unknown } | null | undefined;
  return toPlainPreview(server?.content);
});

const loadCollaborationToken = async () => {
  if (!collaborationEligible.value) {
    collabToken.value = null;
    collaborationStatus.clearStatus(props.note.id);
    return;
  }

  collaborationStatus.setStatus(props.note.id, {
    workspaceId: props.note.workspaceId ?? "",
    enabled: true,
    connected: false,
    synced: false,
    error: null,
  });
  const result = await $api.notes.getCollabToken(props.note.id);
  if (result.success) {
    collabToken.value = result.data;
    return;
  }

  collabToken.value = null;
  collaborationStatus.setStatus(props.note.id, {
    workspaceId: props.note.workspaceId ?? "",
    enabled: true,
    connected: false,
    synced: false,
    error: result.error.message,
  });
};

const saveCollaborationSnapshot = async () => {
  if (!collaborationConfig.value.enabled || editorReadonly.value) return;
  const normalized = normalizeEditorValue(contentHtml.value);
  const draft = buildWorkspaceTextDraftCommit(normalized);
  emit("draft-update", props.note.id, draft);

  const result = await $api.notes.saveCollabSnapshot(props.note.id, draft);
  if (!result.success) {
    collaborationStatus.setStatus(props.note.id, {
      workspaceId: props.note.workspaceId ?? "",
      enabled: true,
      error: result.error.message,
    });
    return;
  }

  lastCommittedContent.value = normalized;
  hasLocalDraft.value = false;
  collaborationStatus.setStatus(props.note.id, {
    workspaceId: props.note.workspaceId ?? "",
    enabled: true,
    error: null,
  });
};

const handleCollaborationStatus = (status: {
  connected?: boolean;
  synced?: boolean;
  indexedDbSynced?: boolean;
  unsyncedChanges?: number;
  error?: string | null;
}) => {
  if (!props.note.workspaceId) return;
  collaborationStatus.setStatus(props.note.id, {
    workspaceId: props.note.workspaceId,
    enabled: collaborationEligible.value,
    ...status,
  });
};

const commitDraft = (noteId = draftNoteId.value, force = false) => {
  if (isConflictError.value) return;
  if (props.readonly && !force) return;
  if (collaborationConfig.value.enabled) {
    void saveCollaborationSnapshot();
    return;
  }
  const normalized = normalizeEditorValue(contentHtml.value);
  if (normalized === lastCommittedContent.value) {
    hasLocalDraft.value = false;
    return;
  }

  emitUpdate(noteId, normalized);
  lastCommittedContent.value = normalized;
  hasLocalDraft.value = false;
};

// Computed classes for parent container — flex column mirrors math/canvas note pattern
const noteContainerClasses = computed(() => {
  return [
    "note-container flex h-full min-h-0 min-w-0 flex-col flex-1 basis-4/5 shrink-0 overflow-hidden",
    "transition-all duration-100",
    "",
  ];
});

watch(
  () => props.note.content,
  (nextContent) => {
    if (props.note.id === draftNoteId.value && hasLocalDraft.value) return;
    const normalized = normalizeEditorValue(nextContent);
    if (normalized === contentHtml.value) return;
    isApplyingExternalContent.value = true;
    contentHtml.value = normalized;
    lastCommittedContent.value = normalized;
    lastDraftSignature.value = "";
    hasLocalDraft.value = false;
    nextTick(() => {
      isApplyingExternalContent.value = false;
    });
  }
);

const handleAddToMaterial = (selectedText: string) => {
  emit("addToMaterial", selectedText);
};



const retry = () => emit("retry", props.note.id);
const resolveConflict = (resolution: "keep-local" | "keep-server" | "manual-merge") =>
  emit("resolve-conflict", props.note.id, resolution);

const flushPendingSave = (noteId = draftNoteId.value) => {
  if (isConflictError.value) return;
  const normalized = normalizeEditorValue(contentHtml.value);
  if (normalized === lastCommittedContent.value) {
    hasLocalDraft.value = false;
    return;
  }
  if (collaborationConfig.value.enabled) {
    flushCollaborationSnapshot();
    void saveCollaborationSnapshot();
    return;
  }
  flushScheduledSave();
  commitDraft(noteId, true);
};

const handleToggleFullscreen = () => {
  flushPendingSave();
  emit("toggle-fullscreen", props.note.id);
};

let unregisterDraftFlusher: (() => void) | null = null;

onMounted(() => {
  if (!props.isBoardItem) {
    unregisterDraftFlusher = registerNotesDraftFlusher(() => flushPendingSave());
  }
  void loadCollaborationToken();
});

onBeforeUnmount(() => {
  if (draftFrame !== null) {
    window.cancelAnimationFrame(draftFrame);
    draftFrame = null;
  }
  flushPendingSave();
  collaborationStatus.clearStatus(props.note.id);
  unregisterDraftFlusher?.();
});

// Watch for tiptap content changes to auto-save (we persist plain text)
watch(contentHtml, () => {
  if (!isEditing.value || editorReadonly.value || isApplyingExternalContent.value) return;
  hasLocalDraft.value = contentHtml.value !== lastCommittedContent.value;
  if (hasLocalDraft.value) {
    emitDraftUpdate();
    if (collaborationConfig.value.enabled) {
      scheduleCollaborationSnapshot();
      return;
    }
    scheduleSave();
  }
});

watch(
  () => props.note.id,
  (nextId, previousId) => {
    if (previousId) {
      flushPendingSave(previousId);
      collaborationStatus.clearStatus(previousId);
    }

    draftNoteId.value = nextId;
    collabToken.value = null;
    const normalized = normalizeEditorValue(props.note.content);
    isApplyingExternalContent.value = true;
    contentHtml.value = normalized;
    lastCommittedContent.value = normalized;
    lastDraftSignature.value = "";
    hasLocalDraft.value = false;
    nextTick(() => {
      isApplyingExternalContent.value = false;
      void loadCollaborationToken();
    });
  },
);

watch(
  collaborationEligible,
  () => {
    void loadCollaborationToken();
  },
);

defineExpose({ flushPendingSave });
</script>

<style scoped>
/* Note container */
.note-container {
  position: relative;
}
</style>

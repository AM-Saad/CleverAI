<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from "vue";
import type {
  NoteLayoutChange,
  PendingNoteChange,
  PendingNoteGroupChange,
} from "@@/shared/utils/note-sync.contract";
import { useNetworkStatus } from "~/composables/shared/useNetworkStatus";
import { createIndexedDbNotesGroupQueue } from "../composables/notesGroupQueue";
import { createIndexedDbNotesLayoutQueue } from "../composables/notesLayoutQueue";
import { createIndexedDbNotesPendingQueue } from "../composables/notesPendingQueue";
import { useNotesCollaborationStatus } from "../composables/notesCollaborationStatus";
import { useNoteGroupsStore } from "../composables/useNoteGroupsStore";
import { useNotesStore } from "../composables/useNotesStore";

const props = defineProps<{
  workspaceId: string;
}>();

const notesStore = useNotesStore(props.workspaceId);
const noteGroupsStore = useNoteGroupsStore(props.workspaceId);
const networkStatus = useNetworkStatus();
const pendingQueue = createIndexedDbNotesPendingQueue();
const groupQueue = createIndexedDbNotesGroupQueue();
const layoutQueue = createIndexedDbNotesLayoutQueue();
const collaborationStatus = useNotesCollaborationStatus();
const collabStatuses = collaborationStatus.byWorkspace(props.workspaceId);

const contentChanges = ref<PendingNoteChange[]>([]);
const groupChanges = ref<PendingNoteGroupChange[]>([]);
const layoutChange = ref<NoteLayoutChange | null>(null);
const isRefreshing = ref(false);
const isSyncing = ref(false);
const errorMessage = ref<string | null>(null);
let refreshTimer: ReturnType<typeof setInterval> | null = null;

const dirtyNotes = computed(() =>
  Array.from(notesStore.notes.value.values()).filter((note) => note.isDirty),
);
const erroredNotes = computed(() =>
  Array.from(notesStore.notes.value.values()).filter((note) => note.error),
);
const layoutSummary = computed(() => {
  if (!layoutChange.value) return "none";
  return `${layoutChange.value.notes.length} notes, ${layoutChange.value.groups.length} groups, v${layoutChange.value.localVersion ?? 0}`;
});
const collabPendingCount = computed(() =>
  collabStatuses.value.filter((status) =>
    status.enabled &&
    (!status.connected || !status.synced || status.unsyncedChanges > 0 || Boolean(status.error)),
  ).length,
);

async function refreshQueues() {
  isRefreshing.value = true;
  errorMessage.value = null;
  try {
    const [content, groups, layout] = await Promise.all([
      pendingQueue.load(props.workspaceId),
      groupQueue.load(props.workspaceId),
      layoutQueue.load(props.workspaceId),
    ]);
    contentChanges.value = content;
    groupChanges.value = groups;
    layoutChange.value = layout;
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : String(error);
  } finally {
    isRefreshing.value = false;
  }
}

async function syncNow() {
  isSyncing.value = true;
  errorMessage.value = null;
  try {
    await notesStore.syncPendingChanges();
    await refreshQueues();
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : String(error);
  } finally {
    isSyncing.value = false;
  }
}

onMounted(() => {
  void refreshQueues();
  refreshTimer = setInterval(() => void refreshQueues(), 2500);
});

onUnmounted(() => {
  if (refreshTimer) {
    clearInterval(refreshTimer);
  }
});
</script>

<template>
  <section class="mx-4 my-2 rounded-[var(--radius-xl)] border border-secondary bg-white p-2 text-xs text-content-secondary">
    <div class="flex flex-wrap items-center justify-between gap-2">
      <div class="flex items-center gap-2">
        <icon name="i-lucide-activity" class="h-3.5 w-3.5 text-primary" />
        <span class="font-semibold text-content-on-surface">Notes sync inspector</span>
        <span class="rounded-[var(--radius-md)] bg-surface-strong px-1.5 py-0.5">
          {{ networkStatus.isVerifiedOnline.value ? "online" : "offline" }}
        </span>
      </div>
      <div class="flex items-center gap-1">
        <ui-button size="xs" color="neutral" variant="ghost" :loading="isRefreshing" @click="refreshQueues">
          Refresh
        </ui-button>
        <ui-button size="xs" color="primary" variant="soft" :loading="isSyncing" @click="syncNow">
          Sync
        </ui-button>
      </div>
    </div>

    <div class="mt-2 grid gap-1 sm:grid-cols-2 lg:grid-cols-4">
      <div>content queue: <span class="font-medium text-content-on-surface">{{ contentChanges.length }}</span></div>
      <div>group queue: <span class="font-medium text-content-on-surface">{{ groupChanges.length }}</span></div>
      <div>layout: <span class="font-medium text-content-on-surface">{{ layoutSummary }}</span></div>
      <div>layout status: <span class="font-medium text-content-on-surface">{{ notesStore.layoutStatus.value }}</span></div>
      <div>dirty notes: <span class="font-medium text-content-on-surface">{{ dirtyNotes.length }}</span></div>
      <div>collab pending: <span class="font-medium text-content-on-surface">{{ collabPendingCount }}</span></div>
      <div>errored notes: <span class="font-medium text-content-on-surface">{{ erroredNotes.length }}</span></div>
      <div>local notes: <span class="font-medium text-content-on-surface">{{ notesStore.notes.value.size }}</span></div>
      <div>local groups: <span class="font-medium text-content-on-surface">{{ noteGroupsStore.groups.value.size }}</span></div>
    </div>

    <details v-if="contentChanges.length || groupChanges.length || layoutChange || collabStatuses.length" class="mt-2">
      <summary class="cursor-pointer text-content-on-surface">Queue detail</summary>
      <pre class="mt-1 max-h-48 overflow-auto rounded-[var(--radius-md)] bg-surface p-2 text-[11px] leading-relaxed">{{ JSON.stringify({
        contentChanges: contentChanges.map((change) => ({
          id: change.id,
          operation: change.operation,
          groupId: change.groupId,
          localVersion: change.localVersion,
        })),
        groupChanges: groupChanges.map((change) => ({
          id: change.id,
          operation: change.operation,
          title: change.title,
          order: change.order,
          groupOrders: change.groupOrders,
        })),
        layoutChange,
        collabStatuses,
      }, null, 2) }}</pre>
    </details>

    <p v-if="errorMessage" class="mt-2 text-error">
      {{ errorMessage }}
    </p>
  </section>
</template>

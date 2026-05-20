import { ref, type Ref } from "vue";
import type {
  NoteGroupLayoutItem,
  NoteLayoutChange,
  NoteLayoutItem,
} from "@@/shared/utils/note-sync.contract";
import type { NotesLocalRepository } from "./notesLocalRepository";
import type { NotesLayoutQueue } from "./notesLayoutQueue";
import type { NoteState } from "./noteTransforms";
import { logNotesOperation } from "./notesOperationLog";
import { useNetworkStatus } from "~/composables/shared/useNetworkStatus";

export type NotesLayoutStatus =
  | "idle"
  | "dragging"
  | "queued"
  | "syncing"
  | "synced"
  | "conflict"
  | "failed";

export type NotesLayoutCommand =
  | { type: "MOVE_NOTE"; noteId: string; toGroupId: string | null; toIndex: number }
  | { type: "REORDER_NOTE"; noteId: string; groupId: string | null; toIndex: number }
  | { type: "REORDER_GROUP"; groupId: string; toIndex: number }
  | { type: "APPLY_NOTE_LAYOUT"; notes: NoteLayoutItem[] };

export interface NotesLayoutController {
  status: Ref<NotesLayoutStatus>;
  apply(command: NotesLayoutCommand): Promise<boolean>;
  queueNoteLayout(noteLayout: NoteLayoutItem[]): Promise<boolean>;
}

function groupKey(groupId: string | null) {
  return groupId ?? "__ungrouped__";
}

export function buildCanonicalNoteLayout(
  notes: Iterable<Pick<NoteState, "id" | "groupId" | "order">>,
): NoteLayoutItem[] {
  const ordered = Array.from(notes).sort((a, b) => {
    const aGroupId = a.groupId ?? null;
    const bGroupId = b.groupId ?? null;
    const groupCompare =
      aGroupId === bGroupId
        ? 0
        : aGroupId === null
          ? 1
          : bGroupId === null
            ? -1
            : groupKey(aGroupId).localeCompare(groupKey(bGroupId));
    return groupCompare || a.order - b.order || a.id.localeCompare(b.id);
  });
  const orderByGroup = new Map<string, number>();

  return ordered.map((note) => {
    const key = groupKey(note.groupId ?? null);
    const order = orderByGroup.get(key) ?? 0;
    orderByGroup.set(key, order + 1);
    return {
      id: note.id,
      groupId: note.groupId ?? null,
      order,
    };
  });
}

export function createNotesLayoutController(input: {
  workspaceId: string;
  notes: Ref<Map<string, NoteState>>;
  localRepository: NotesLocalRepository;
  layoutQueue: NotesLayoutQueue;
  getGroupLayout: () => NoteGroupLayoutItem[];
  onLayoutPendingChanged: () => Promise<void>;
  requestSync: () => void;
}): NotesLayoutController {
  const {
    workspaceId,
    notes,
    localRepository,
    layoutQueue,
    getGroupLayout,
    onLayoutPendingChanged,
    requestSync,
  } = input;
  const networkMonitor = useNetworkStatus();
  const status = ref<NotesLayoutStatus>("idle");
  let activeAbortController: AbortController | null = null;
  let saveToServerTimer: ReturnType<typeof setTimeout> | null = null;

  const saveLayoutChange = async (noteLayout: NoteLayoutItem[]) => {
    console.log(`🔍 [TRACE:REORDER] layoutController.saveLayoutChange`, { noteCount: noteLayout.length });
    try {
      console.log(`🔍 [TRACE:REORDER] saveLayoutChange → step 1: layoutQueue.load()`);
      const existingLayout = await layoutQueue.load(workspaceId);
      console.log(`🔍 [TRACE:REORDER] saveLayoutChange → step 1 DONE`, { hadExisting: !!existingLayout });

      const change: NoteLayoutChange = {
        id: workspaceId,
        workspaceId,
        updatedAt: Date.now(),
        localVersion: (existingLayout?.localVersion ?? 0) + 1,
        notes: noteLayout,
        groups: existingLayout?.groups?.length ? existingLayout.groups : getGroupLayout(),
      };

      console.log(`🔍 [TRACE:REORDER] saveLayoutChange → step 2: layoutQueue.save()`);
      await layoutQueue.save(change);
      console.log(`🔍 [TRACE:REORDER] saveLayoutChange → step 2 DONE`);

      console.log(`🔍 [TRACE:REORDER] saveLayoutChange → step 3: onLayoutPendingChanged()`);
      if (!networkMonitor.isVerifiedOnline.value) {
        await layoutQueue.registerBackgroundSync();
      }
      await onLayoutPendingChanged();
      console.log(`🔍 [TRACE:REORDER] saveLayoutChange → step 3 DONE`);

      status.value = "queued";
      console.log(`🔍 [TRACE:REORDER] layoutController.saveLayoutChange SAVED to IDB`, { localVersion: change.localVersion, notes: change.notes.length, groups: change.groups.length });
      logNotesOperation("layout-queued", {
        workspaceId,
        notes: noteLayout.length,
        groups: change.groups.length,
      });

      // Clear any pending debounce timer
      if (saveToServerTimer) {
        clearTimeout(saveToServerTimer);
        saveToServerTimer = null;
      }

      // Abort the active background update
      if (activeAbortController) {
        console.log(`🔍 [TRACE:REORDER] aborting active layout PATCH request`);
        activeAbortController.abort();
        activeAbortController = null;
      }

      // Debounce server PATCH for 1000ms
      saveToServerTimer = setTimeout(async () => {
        saveToServerTimer = null;

        if (!networkMonitor.isVerifiedOnline.value) {
          console.log(`🔍 [TRACE:REORDER] background layout update deferred — currently offline`);
          return;
        }

        const controller = new AbortController();
        activeAbortController = controller;

        try {
          status.value = "syncing";
          console.log(`🔍 [TRACE:REORDER] sending layout PATCH request to server...`);
          const { $api } = useNuxtApp();
          const res = await $api.notes.reorder(
            {
              workspaceId,
              noteOrders: noteLayout.map((n) => ({
                id: n.id,
                groupId: n.groupId,
                order: n.order,
              })),
            },
            { signal: controller.signal }
          );

          if (controller.signal.aborted) {
            console.log(`🔍 [TRACE:REORDER] request aborted, ignoring response`);
            return;
          }

          if (activeAbortController === controller) {
            activeAbortController = null;
          }

          if (res.success) {
            if (res.data.layoutApplied) {
              console.log(`🔍 [TRACE:REORDER] server accepted layout layoutApplied=true`);
              const fresh = await layoutQueue.load(workspaceId);
              if (fresh && fresh.localVersion === change.localVersion) {
                await layoutQueue.remove(workspaceId);
                await onLayoutPendingChanged();
              }
              status.value = "synced";
            } else {
              console.warn(`🔍 [TRACE:REORDER] layout PATCH returned layoutApplied=false`);
              status.value = "failed";
            }
          } else {
            console.warn(`🔍 [TRACE:REORDER] layout PATCH failed`, res.error);
            status.value = "failed";
          }
        } catch (error: any) {
          if (error.name === "AbortError" || (error instanceof Error && error.message.includes("aborted"))) {
            console.log(`🔍 [TRACE:REORDER] layout PATCH aborted successfully`);
            return;
          }
          console.error(`🔍 [TRACE:REORDER] layout PATCH error`, error);
          status.value = "failed";
        }
      }, 1000);

    } catch (err) {
      console.error(`🔍 [TRACE:REORDER] saveLayoutChange ERROR`, err);
      throw err;
    }
  };

  const queueNoteLayout = async (noteLayout: NoteLayoutItem[]): Promise<boolean> => {
    console.log(`🔍 [TRACE:REORDER] layoutController.queueNoteLayout`, { itemCount: noteLayout.length });
    try {
      const canonical = buildCanonicalNoteLayout(noteLayout);
      const changedNotes: NoteState[] = [];

      for (const item of canonical) {
        const existing = notes.value.get(item.id);
        if (!existing) continue;
        if (existing.groupId === item.groupId && existing.order === item.order) continue;

        const nextNote = {
          ...existing,
          groupId: item.groupId,
          order: item.order,
        };
        notes.value.set(item.id, nextNote);
        changedNotes.push(nextNote);
      }

      if (!changedNotes.length) {
        console.log(`🔍 [TRACE:REORDER] layoutController.queueNoteLayout — NO CHANGES detected`);
        return true;
      }

      console.log(`🔍 [TRACE:REORDER] layoutController.queueNoteLayout — ${changedNotes.length} notes changed, saving to IDB`);
      console.log(`🔍 [TRACE:REORDER] queueNoteLayout → localRepository.saveMany START`);
      await localRepository.saveMany(changedNotes);
      console.log(`🔍 [TRACE:REORDER] queueNoteLayout → localRepository.saveMany DONE`);
      await saveLayoutChange(canonical);
      return true;
    } catch (error) {
      console.error(`🔍 [TRACE:REORDER] layoutController.queueNoteLayout ERROR`, error);
      status.value = "failed";
      logNotesOperation("sync-failure", {
        workspaceId,
        reason: "layout-queue-failed",
        error,
      });
      return false;
    }
  };

  const apply = async (command: NotesLayoutCommand): Promise<boolean> => {
    console.log(`🔍 [TRACE:REORDER] layoutController.apply`, { type: command.type });
    if (command.type === "APPLY_NOTE_LAYOUT") {
      return queueNoteLayout(command.notes);
    }

    const current = buildCanonicalNoteLayout(notes.value.values());
    if (command.type === "MOVE_NOTE" || command.type === "REORDER_NOTE") {
      const moving = current.find((note) => note.id === command.noteId);
      if (!moving) return false;

      const targetGroupId =
        command.type === "MOVE_NOTE" ? command.toGroupId : command.groupId;
      const withoutMoving = current.filter((note) => note.id !== command.noteId);
      const targetGroup = withoutMoving.filter((note) => note.groupId === targetGroupId);
      const targetIndex = Math.max(0, Math.min(command.toIndex, targetGroup.length));
      targetGroup.splice(targetIndex, 0, { ...moving, groupId: targetGroupId });

      const nextLayout = withoutMoving
        .filter((note) => note.groupId !== targetGroupId)
        .concat(targetGroup);
      return queueNoteLayout(nextLayout);
    }

    return true;
  };

  return {
    status,
    apply,
    queueNoteLayout,
  };
}

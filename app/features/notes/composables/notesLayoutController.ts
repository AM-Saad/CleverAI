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
  const status = ref<NotesLayoutStatus>("idle");
  let layoutGeneration = 0;

  const saveLayoutChange = async (noteLayout: NoteLayoutItem[], generation: number) => {
    try {
      if (generation !== layoutGeneration) return;
      const existingLayout = await layoutQueue.load(workspaceId);
      if (generation !== layoutGeneration) return;
      const currentGroupLayout = getGroupLayout();

      const change: NoteLayoutChange = {
        id: workspaceId,
        workspaceId,
        updatedAt: Date.now(),
        localVersion: (existingLayout?.localVersion ?? 0) + 1,
        notes: noteLayout,
        groups: currentGroupLayout.length ? currentGroupLayout : existingLayout?.groups ?? [],
      };

      await layoutQueue.save(change);
      if (generation !== layoutGeneration) return;

      await layoutQueue.registerBackgroundSync();
      await onLayoutPendingChanged();

      status.value = "queued";
      logNotesOperation("layout-queued", {
        workspaceId,
        notes: noteLayout.length,
        groups: change.groups.length,
      });

      requestSync();

    } catch (err) {
      console.error("Failed to save note layout locally", err);
      throw err;
    }
  };

  const queueNoteLayout = async (noteLayout: NoteLayoutItem[]): Promise<boolean> => {
    const generation = ++layoutGeneration;
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

    status.value = "queued";
    void (async () => {
      try {
        if (changedNotes.length) {
          await localRepository.saveMany(changedNotes);
        }

        await saveLayoutChange(canonical, generation);
      } catch (error) {
        console.error("Failed to queue note layout", error);
        status.value = "failed";
        logNotesOperation("sync-failure", {
          workspaceId,
          reason: "layout-queue-failed",
          error,
        });
      }
    })();

    return true;
  };

  const apply = async (command: NotesLayoutCommand): Promise<boolean> => {
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
      const notesByGroup = new Map<string, NoteLayoutItem[]>();
      for (const note of withoutMoving) {
        const key = groupKey(note.groupId);
        const group = notesByGroup.get(key) ?? [];
        group.push(note);
        notesByGroup.set(key, group);
      }

      for (const group of notesByGroup.values()) {
        group.sort((a, b) => a.order - b.order || a.id.localeCompare(b.id));
      }

      const targetKey = groupKey(targetGroupId);
      const targetGroup = notesByGroup.get(targetKey) ?? [];
      const targetIndex = Math.max(0, Math.min(command.toIndex, targetGroup.length));
      targetGroup.splice(targetIndex, 0, { ...moving, groupId: targetGroupId });
      notesByGroup.set(targetKey, targetGroup);

      const nextLayout = Array.from(notesByGroup.values()).flatMap((group) =>
        group.map((note, order) => ({ ...note, order })),
      );
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

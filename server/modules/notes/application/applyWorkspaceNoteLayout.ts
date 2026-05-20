import type { NoteLayoutChange } from "../../../../shared/utils/note-sync.contract";
import { Errors } from "../../../utils/error";

function assertUnique(ids: string[], label: string) {
  if (new Set(ids).size !== ids.length) {
    throw Errors.badRequest(`Duplicate ${label} in note layout change`);
  }
}

/**
 * Lenient order normalisation: re-number notes within each group so their
 * orders form a contiguous 0…N sequence.  This is more forgiving than the
 * old strict assertion – the client may legitimately send non-contiguous
 * orders when offline edits created gaps (deleted notes, moved notes, etc.).
 */
function normaliseGroupOrders(layout: NoteLayoutChange): NoteLayoutChange {
  const byGroup = new Map<string, typeof layout.notes>();
  for (const note of layout.notes) {
    const key = note.groupId ?? "__ungrouped__";
    const group = byGroup.get(key) ?? [];
    group.push(note);
    byGroup.set(key, group);
  }

  const normalisedNotes = Array.from(byGroup.values()).flatMap((notes) => {
    const sorted = notes.slice().sort((a, b) => a.order - b.order);
    return sorted.map((note, index) => ({ ...note, order: index }));
  });

  return { ...layout, notes: normalisedNotes };
}

export async function applyWorkspaceNoteLayout(input: {
  prisma: any;
  userId: string;
  layout: NoteLayoutChange;
}) {
  const { prisma, userId, layout: rawLayout } = input;
  console.log(`🔍 [TRACE:SERVER] applyWorkspaceNoteLayout`, { workspaceId: rawLayout.workspaceId, notes: rawLayout.notes.length, groups: rawLayout.groups.length });

  const workspace = await prisma.workspace.findFirst({
    where: { id: rawLayout.workspaceId, userId },
  });
  if (!workspace) {
    throw Errors.notFound("Workspace");
  }

  // Normalise orders before validation so offline gaps don't cause failures
  const layout = normaliseGroupOrders(rawLayout);

  const noteIds = layout.notes.map((note) => note.id);
  const groupIds = layout.groups.map((group) => group.id);
  const noteGroupIds = layout.notes
    .map((note) => note.groupId)
    .filter((id): id is string => Boolean(id));
  const requestedGroupIds = Array.from(new Set([...groupIds, ...noteGroupIds]));

  assertUnique(noteIds, "notes");
  assertUnique(groupIds, "groups");

  // ── Lenient filtering ──
  // Instead of throwing when some notes/groups don't exist on the server,
  // silently skip them. This handles cases where a note was deleted on
  // another device, or a temp-ID note creation was rejected while the
  // layout change was still pending.
  const skippedNotes: string[] = [];
  const skippedGroups: string[] = [];

  let validNoteIds = new Set(noteIds);
  const currentNoteState = new Map<string, { id: string; groupId: string | null; order: number }>();
  if (noteIds.length) {
    const notes = await prisma.note.findMany({
      where: {
        id: { in: noteIds },
        workspaceId: layout.workspaceId,
      },
      select: { id: true, groupId: true, order: true },
    });
    const existingNoteIds = new Set<string>(notes.map((n: { id: string }) => n.id));
    validNoteIds = existingNoteIds;
    for (const n of notes) {
      currentNoteState.set(n.id, { id: n.id, groupId: n.groupId ?? null, order: n.order });
    }
    for (const id of noteIds) {
      if (!existingNoteIds.has(id)) {
        skippedNotes.push(id);
      }
    }
  }

  let validGroupIds = new Set<string>(requestedGroupIds);
  const currentGroupState = new Map<string, { id: string; order: number }>();
  if (requestedGroupIds.length) {
    const groups = await prisma.noteGroup.findMany({
      where: {
        id: { in: requestedGroupIds },
        workspaceId: layout.workspaceId,
      },
      select: { id: true, order: true },
    });
    const existingGroupIds = new Set<string>(groups.map((g: { id: string }) => g.id));
    validGroupIds = existingGroupIds;
    for (const g of groups) {
      currentGroupState.set(g.id, { id: g.id, order: g.order });
    }
    for (const id of requestedGroupIds) {
      if (!existingGroupIds.has(id)) {
        skippedGroups.push(id);
      }
    }
  }

  // Filter layout to only include valid notes and groups
  const validNotes = layout.notes.filter(
    (note) =>
      validNoteIds.has(note.id) &&
      (!note.groupId || validGroupIds.has(note.groupId)),
  );
  const validGroups = layout.groups.filter((group) =>
    validGroupIds.has(group.id),
  );

  // Diff against current DB state — only update records that actually changed.
  // This avoids writing 19 records when only 2 moved.
  const changedNotes = validNotes.filter((note) => {
    const cur = currentNoteState.get(note.id);
    if (!cur) return true;
    return cur.groupId !== (note.groupId ?? null) || cur.order !== note.order;
  });
  const changedGroups = validGroups.filter((group) => {
    const cur = currentGroupState.get(group.id);
    if (!cur) return true;
    return cur.order !== group.order;
  });

  console.log(`🔍 [TRACE:SERVER] applyWorkspaceNoteLayout — valid: ${validNotes.length} notes, ${validGroups.length} groups | changed: ${changedNotes.length} notes, ${changedGroups.length} groups | skipped: ${skippedNotes.length} notes, ${skippedGroups.length} groups`);

  // Individual parallel updates — no transaction needed since each is idempotent
  if (changedNotes.length || changedGroups.length) {
    await Promise.all([
      ...changedNotes.map((note) =>
        prisma.note.update({
          where: { id: note.id },
          data: {
            groupId: note.groupId,
            order: note.order,
          },
        }),
      ),
      ...changedGroups.map((group) =>
        prisma.noteGroup.update({
          where: { id: group.id },
          data: { order: group.order },
        }),
      ),
    ]);
  }

  console.log(`🔍 [TRACE:SERVER] applyWorkspaceNoteLayout DONE`);
  return { layoutApplied: true, skippedNotes, skippedGroups };
}

import { PrismaClient } from "@prisma/client";
import { positionBetween } from "../../shared/utils/position-key";

const prisma = new PrismaClient();

type PositionedRow = { id: string; userId?: string; workspaceId?: string | null; groupId?: string | null; columnId?: string | null };

async function assignPositions(input: {
  entity: "workspace" | "note" | "noteGroup" | "boardItem" | "boardColumn" | "userTag";
  model: any;
  rows: PositionedRow[];
  group: (row: PositionedRow) => string;
}) {
  const previousByGroup = new Map<string, string | undefined>();
  for (const row of input.rows) {
    const group = input.group(row);
    const position = positionBetween(previousByGroup.get(group), null);
    await input.model.update({ where: { id: row.id }, data: { position } });
    previousByGroup.set(group, position);
    // Existing data starts at revision 0. The first normal online write will
    // advance it; a downloaded pack can safely use 0 as its initial base.
    const userId = row.userId;
    if (userId) {
      await prisma.offlineEntityState.upsert({
        where: { userId_entity_entityId: { userId, entity: input.entity, entityId: row.id } },
        update: {},
        create: { userId, entity: input.entity, entityId: row.id, version: 0, fieldVersions: {} },
      });
    }
  }
}

async function main() {
  // The project has no production users yet, but this migration keeps the
  // rollout safe for seeded/staging data and makes a later import explicit.
  const [workspaces, noteRecords, noteGroupRecords, boardItems, boardColumns, userTags] = await Promise.all([
    prisma.workspace.findMany({ select: { id: true, userId: true }, orderBy: [{ userId: "asc" }, { order: "asc" }, { id: "asc" }] }),
    prisma.note.findMany({ select: { id: true, workspaceId: true, groupId: true, workspace: { select: { userId: true } } }, orderBy: [{ workspaceId: "asc" }, { groupId: "asc" }, { order: "asc" }, { id: "asc" }] }),
    prisma.noteGroup.findMany({ select: { id: true, workspaceId: true, workspace: { select: { userId: true } } }, orderBy: [{ workspaceId: "asc" }, { order: "asc" }, { id: "asc" }] }),
    prisma.boardItem.findMany({ select: { id: true, userId: true, workspaceId: true, columnId: true }, orderBy: [{ userId: "asc" }, { columnId: "asc" }, { order: "asc" }, { id: "asc" }] }),
    prisma.boardColumn.findMany({ select: { id: true, userId: true, workspaceId: true }, orderBy: [{ userId: "asc" }, { workspaceId: "asc" }, { order: "asc" }, { id: "asc" }] }),
    prisma.userTag.findMany({ select: { id: true, userId: true }, orderBy: [{ userId: "asc" }, { order: "asc" }, { id: "asc" }] }),
  ]);
  const notes = noteRecords.map(({ workspace, ...note }) => ({ ...note, userId: workspace.userId }));
  const noteGroups = noteGroupRecords.map(({ workspace, ...group }) => ({ ...group, userId: workspace.userId }));

  await assignPositions({ entity: "workspace", model: prisma.workspace, rows: workspaces, group: (row) => row.userId! });
  await assignPositions({ entity: "note", model: prisma.note, rows: notes, group: (row) => `${row.workspaceId}:${row.groupId ?? "root"}` });
  await assignPositions({ entity: "noteGroup", model: prisma.noteGroup, rows: noteGroups, group: (row) => row.workspaceId! });
  await assignPositions({ entity: "boardItem", model: prisma.boardItem, rows: boardItems, group: (row) => `${row.userId}:${row.columnId ?? "uncategorized"}` });
  await assignPositions({ entity: "boardColumn", model: prisma.boardColumn, rows: boardColumns, group: (row) => `${row.userId}:${row.workspaceId ?? "global"}` });
  await assignPositions({ entity: "userTag", model: prisma.userTag, rows: userTags, group: (row) => row.userId! });

  console.log(`Backfilled position keys for ${workspaces.length + notes.length + noteGroups.length + boardItems.length + boardColumns.length + userTags.length} records.`);
}

main()
  .catch((error) => {
    console.error("Offline-v2 backfill failed", error);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());

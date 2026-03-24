/**
 * Migration script to set the 'type' field for existing notes
 * Uses raw MongoDB commands to bypass Prisma's default value behavior
 * - Notes with workspaceId but no type -> type = "FOLDER"
 * - Notes without workspaceId -> type = "BOARD"
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("🔄 Starting note type migration (using raw MongoDB)...");
  console.log("📍 DATABASE_URL:", process.env.DATABASE_URL?.substring(0, 50) + "...");

  // Use raw MongoDB to find documents where 'type' field doesn't exist
  const notesWithoutType = await prisma.$runCommandRaw({
    find: "Note",
    filter: { type: { $exists: false } },
  }) as { cursor: { firstBatch: Array<{ _id: { $oid: string }; workspaceId?: string }> } };

  const notes = notesWithoutType.cursor?.firstBatch || [];
  console.log(`📊 Found ${notes.length} notes WITHOUT type field (raw MongoDB)`);

  if (notes.length === 0) {
    console.log("✅ No migration needed - all notes have type set in MongoDB");
    return;
  }

  // Separate workspace notes from board notes
  const workspaceNoteIds = notes.filter((n) => n.workspaceId).map((n) => n._id);
  const boardNoteIds = notes.filter((n) => !n.workspaceId).map((n) => n._id);

  console.log(`📁 Workspace notes to migrate: ${workspaceNoteIds.length}`);
  console.log(`📋 Board notes to migrate: ${boardNoteIds.length}`);

  // Update workspace notes using raw MongoDB updateMany
  if (workspaceNoteIds.length > 0) {
    const workspaceResult = await prisma.$runCommandRaw({
      update: "Note",
      updates: [
        {
          q: { type: { $exists: false }, workspaceId: { $exists: true } },
          u: { $set: { type: "FOLDER" } },
          multi: true,
        },
      ],
    }) as { nModified?: number; n?: number };
    console.log(`✅ Updated ${workspaceResult.nModified ?? workspaceResult.n ?? 0} workspace notes`);
  }

  // Update board notes (no workspaceId) using raw MongoDB updateMany
  if (boardNoteIds.length > 0) {
    const boardResult = await prisma.$runCommandRaw({
      update: "Note",
      updates: [
        {
          q: { type: { $exists: false }, workspaceId: { $exists: false } },
          u: { $set: { type: "BOARD" } },
          multi: true,
        },
      ],
    }) as { nModified?: number; n?: number };
    console.log(`✅ Updated ${boardResult.nModified ?? boardResult.n ?? 0} board notes`);
  }

  console.log("🎉 Migration complete!");

  // Verify using raw MongoDB
  const remaining = await prisma.$runCommandRaw({
    count: "Note",
    query: { type: { $exists: false } },
  }) as { n: number };

  if (remaining.n === 0) {
    console.log("✅ Verification passed - all notes have type set in MongoDB");
  } else {
    console.warn(`⚠️ Warning: ${remaining.n} notes still without type`);
  }
}

main()
  .catch((e) => {
    console.error("❌ Migration failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

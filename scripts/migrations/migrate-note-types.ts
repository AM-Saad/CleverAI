/**
 * Migration script to set the 'type' field for existing notes
 * Uses raw MongoDB commands to bypass Prisma's default value behavior
 * - Notes with folderId but no type -> type = "FOLDER"
 * - Notes without folderId -> type = "BOARD"
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
  }) as { cursor: { firstBatch: Array<{ _id: { $oid: string }; folderId?: string }> } };

  const notes = notesWithoutType.cursor?.firstBatch || [];
  console.log(`📊 Found ${notes.length} notes WITHOUT type field (raw MongoDB)`);

  if (notes.length === 0) {
    console.log("✅ No migration needed - all notes have type set in MongoDB");
    return;
  }

  // Separate folder notes from board notes
  const folderNoteIds = notes.filter((n) => n.folderId).map((n) => n._id);
  const boardNoteIds = notes.filter((n) => !n.folderId).map((n) => n._id);

  console.log(`📁 Folder notes to migrate: ${folderNoteIds.length}`);
  console.log(`📋 Board notes to migrate: ${boardNoteIds.length}`);

  // Update folder notes using raw MongoDB updateMany
  if (folderNoteIds.length > 0) {
    const folderResult = await prisma.$runCommandRaw({
      update: "Note",
      updates: [
        {
          q: { type: { $exists: false }, folderId: { $exists: true } },
          u: { $set: { type: "FOLDER" } },
          multi: true,
        },
      ],
    }) as { nModified?: number; n?: number };
    console.log(`✅ Updated ${folderResult.nModified ?? folderResult.n ?? 0} folder notes`);
  }

  // Update board notes (no folderId) using raw MongoDB updateMany
  if (boardNoteIds.length > 0) {
    const boardResult = await prisma.$runCommandRaw({
      update: "Note",
      updates: [
        {
          q: { type: { $exists: false }, folderId: { $exists: false } },
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

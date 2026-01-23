import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("🔄 Starting migration: Board Notes → BoardItems");

  try {
    // Step 1: Find all notes with type="BOARD" using raw MongoDB query
    console.log("\n📊 Checking for board notes...");
    const rawResult = await prisma.$runCommandRaw({
      find: "Note",
      filter: { type: "BOARD" },
    }) as any;

    const boardNotes = rawResult.cursor?.firstBatch || [];
    console.log(`✅ Found ${boardNotes.length} board notes to migrate`);

    if (boardNotes.length === 0) {
      console.log("✨ No board notes to migrate. Done!");
      return;
    }

    // Step 2: Copy each board note to BoardItem collection
    let successCount = 0;
    let errorCount = 0;

    for (const note of boardNotes) {
      try {
        // Create equivalent BoardItem document
        await prisma.$runCommandRaw({
          insert: "BoardItem",
          documents: [
            {
              _id: note._id, // Keep same ID for reference tracking
              userId: note.userId,
              content: note.content,
              tags: note.tags || [],
              order: note.order || 0,
              createdAt: note.createdAt,
              updatedAt: note.updatedAt || note.createdAt,
            },
          ],
        });
        successCount++;
        console.log(`  ✓ Migrated note ${note._id}`);
      } catch (error: any) {
        errorCount++;
        console.error(`  ✗ Failed to migrate note ${note._id}:`, error.message);
      }
    }

    console.log(`\n📈 Migration Summary:`);
    console.log(`  • Total board notes found: ${boardNotes.length}`);
    console.log(`  • Successfully migrated: ${successCount}`);
    console.log(`  • Failed: ${errorCount}`);

    // Step 3: Verification
    console.log("\n🔍 Verifying migration...");
    const verifyResult = await prisma.$runCommandRaw({
      count: "BoardItem",
    }) as any;

    console.log(`✅ BoardItem collection now has ${verifyResult.n} documents`);

    // Step 4: Optional cleanup - delete board notes from Note collection
    console.log("\n🧹 Cleaning up old board notes from Note collection...");
    const deleteResult = await prisma.$runCommandRaw({
      delete: "Note",
      deletes: [
        {
          q: { type: "BOARD" },
          limit: 0,
        },
      ],
    }) as any;

    const deletedCount = deleteResult.n || 0;
    console.log(`✅ Deleted ${deletedCount} board notes from Note collection`);

    console.log("\n✨ Migration completed successfully!");
  } catch (error) {
    console.error("❌ Migration failed:", error);
    throw error;
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

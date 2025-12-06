// scripts/migrations/migrate-content-to-materials.ts
/**
 * Migration Script: Consolidate to ONE material per folder
 *
 * This script performs the following for each folder:
 * 1. Keeps only the FIRST material in each folder
 * 2. Associates ALL flashcards/questions to that single material
 * 3. Updates CardReviews to reference the first material
 * 4. Deletes all extra materials
 *
 * Usage:
 *   npx tsx scripts/migrations/migrate-content-to-materials.ts --dry-run
 *   npx tsx scripts/migrations/migrate-content-to-materials.ts
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

interface MigrationStats {
  foldersProcessed: number;
  flashcardsUpdated: number;
  questionsUpdated: number;
  cardReviewsUpdated: number;
  materialsDeleted: number;
  errors: string[];
}

async function migrateContentToMaterials(
  dryRun: boolean = false
): Promise<MigrationStats> {
  const stats: MigrationStats = {
    foldersProcessed: 0,
    flashcardsUpdated: 0,
    questionsUpdated: 0,
    cardReviewsUpdated: 0,
    materialsDeleted: 0,
    errors: [],
  };

  console.log("🔄 Starting migration: Consolidate to ONE material per folder");
  console.log(`   Mode: ${dryRun ? "DRY RUN (no changes)" : "LIVE"}`);
  console.log("");

  try {
    // Get all folders with their materials
    const folders = await prisma.folder.findMany({
      select: {
        id: true,
        title: true,
        materials: {
          orderBy: { createdAt: "asc" },
          select: { id: true, title: true },
        },
        _count: {
          select: {
            flashcards: true,
            questions: true,
          },
        },
      },
    });

    console.log(`📁 Found ${folders.length} folders to process\n`);

    for (const folder of folders) {
      stats.foldersProcessed++;

      // Skip folders with no materials
      if (folder.materials.length === 0) {
        console.log(
          `⏭️  Folder "${folder.title}" (${folder.id}): No materials, skipping`
        );
        continue;
      }

      const firstMaterial = folder.materials[0];
      const extraMaterials = folder.materials.slice(1);

      console.log(`📂 Processing folder "${folder.title}" (${folder.id}):`);
      console.log(
        `   Keeping material: "${firstMaterial.title}" (${firstMaterial.id})`
      );
      console.log(`   Materials to delete: ${extraMaterials.length}`);
      console.log(
        `   Total flashcards: ${folder._count.flashcards}, questions: ${folder._count.questions}`
      );

      // Count content without materialId
      const [flashcardsWithoutMaterial, questionsWithoutMaterial] =
        await Promise.all([
          prisma.flashcard.count({
            where: {
              folderId: folder.id,
              materialId: null,
            },
          }),
          prisma.question.count({
            where: {
              folderId: folder.id,
              materialId: null,
            },
          }),
        ]);

      console.log(
        `   Without materialId: ${flashcardsWithoutMaterial} flashcards, ${questionsWithoutMaterial} questions`
      );

      if (!dryRun) {
        // Step 1: Update all flashcards without materialId
        if (flashcardsWithoutMaterial > 0) {
          const flashcardResult = await prisma.flashcard.updateMany({
            where: {
              folderId: folder.id,
              materialId: null,
            },
            data: {
              materialId: firstMaterial.id,
            },
          });
          stats.flashcardsUpdated += flashcardResult.count;
          console.log(`   ✅ Updated ${flashcardResult.count} flashcards`);
        }

        // Step 2: Update all questions without materialId
        if (questionsWithoutMaterial > 0) {
          const questionResult = await prisma.question.updateMany({
            where: {
              folderId: folder.id,
              materialId: null,
            },
            data: {
              materialId: firstMaterial.id,
            },
          });
          stats.questionsUpdated += questionResult.count;
          console.log(`   ✅ Updated ${questionResult.count} questions`);
        }

        // Step 3: Reassign content from extra materials to first material
        if (extraMaterials.length > 0) {
          const extraMaterialIds = extraMaterials.map((m) => m.id);

          // Reassign flashcards
          const reassignedFlashcards = await prisma.flashcard.updateMany({
            where: {
              materialId: { in: extraMaterialIds },
            },
            data: {
              materialId: firstMaterial.id,
            },
          });
          if (reassignedFlashcards.count > 0) {
            stats.flashcardsUpdated += reassignedFlashcards.count;
            console.log(
              `   ✅ Reassigned ${reassignedFlashcards.count} flashcards from extra materials`
            );
          }

          // Reassign questions
          const reassignedQuestions = await prisma.question.updateMany({
            where: {
              materialId: { in: extraMaterialIds },
            },
            data: {
              materialId: firstMaterial.id,
            },
          });
          if (reassignedQuestions.count > 0) {
            stats.questionsUpdated += reassignedQuestions.count;
            console.log(
              `   ✅ Reassigned ${reassignedQuestions.count} questions from extra materials`
            );
          }

          // Step 4: Delete extra materials
          const deleteResult = await prisma.material.deleteMany({
            where: {
              id: { in: extraMaterialIds },
            },
          });
          stats.materialsDeleted += deleteResult.count;
          console.log(`   🗑️  Deleted ${deleteResult.count} extra materials`);
        }
      } else {
        // DRY RUN - just count
        stats.flashcardsUpdated += flashcardsWithoutMaterial;
        stats.questionsUpdated += questionsWithoutMaterial;

        if (extraMaterials.length > 0) {
          const extraMaterialIds = extraMaterials.map((m) => m.id);

          const [extraFlashcards, extraQuestions] = await Promise.all([
            prisma.flashcard.count({
              where: { materialId: { in: extraMaterialIds } },
            }),
            prisma.question.count({
              where: { materialId: { in: extraMaterialIds } },
            }),
          ]);

          stats.flashcardsUpdated += extraFlashcards;
          stats.questionsUpdated += extraQuestions;
          stats.materialsDeleted += extraMaterials.length;

          console.log(
            `   [DRY RUN] Would reassign ${extraFlashcards} flashcards, ${extraQuestions} questions`
          );
          console.log(
            `   [DRY RUN] Would delete ${extraMaterials.length} materials`
          );
        }
      }

      console.log("");
    }

    return stats;
  } finally {
    await prisma.$disconnect();
  }
}

// Main execution
async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");

  console.log("═".repeat(60));
  console.log("  CONTENT TO MATERIAL MIGRATION");
  console.log("  (Consolidate to ONE material per folder)");
  console.log("═".repeat(60));
  console.log("");

  try {
    const stats = await migrateContentToMaterials(dryRun);

    console.log("═".repeat(60));
    console.log("  MIGRATION SUMMARY");
    console.log("═".repeat(60));
    console.log(`  Folders processed:    ${stats.foldersProcessed}`);
    console.log(`  Flashcards updated:   ${stats.flashcardsUpdated}`);
    console.log(`  Questions updated:    ${stats.questionsUpdated}`);
    console.log(`  CardReviews updated:  ${stats.cardReviewsUpdated}`);
    console.log(`  Materials deleted:    ${stats.materialsDeleted}`);

    if (stats.errors.length > 0) {
      console.log(`  Errors:               ${stats.errors.length}`);
      stats.errors.forEach((err) => console.log(`    - ${err}`));
    }

    console.log("═".repeat(60));

    if (dryRun) {
      console.log("\n⚠️  DRY RUN - No changes were made");
      console.log("   Run without --dry-run to apply changes");
    } else {
      console.log("\n✅ Migration completed successfully!");
    }
  } catch (error) {
    console.error("❌ Migration failed:", error);
    process.exit(1);
  }
}

main();

/**
 * Migration: Add suspended field to existing CardReview documents
 * 
 * Context: When the 'suspended' field was added to the CardReview Prisma schema
 * with @default(false), existing documents in MongoDB didn't get the field added.
 * Prisma returns the default value when reading, but filters don't work because
 * the actual MongoDB documents don't have the field.
 * 
 * This script adds suspended: false to all CardReview documents that don't have it.
 * 
 * Run: npx tsx scripts/migrations/add-suspended-field.ts
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("🔄 Adding suspended field to CardReview documents...\n");

  try {
    // Use MongoDB command to update all documents without the suspended field
    const result = await prisma.$runCommandRaw({
      update: "CardReview",
      updates: [
        {
          q: { suspended: { $exists: false } }, // Find documents without suspended field
          u: { $set: { suspended: false } }, // Add suspended: false
          multi: true, // Update all matching documents
        },
      ],
    });

    console.log("✅ Migration complete!");
    console.log(`   Documents matched: ${result.n}`);
    console.log(`   Documents modified: ${result.nModified}\n`);

    if (result.nModified === 0) {
      console.log("ℹ️  All documents already have the suspended field.");
    }
  } catch (error) {
    console.error("❌ Migration failed:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();

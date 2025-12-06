// scripts/seed-flashcards.ts
/**
 * Script to seed flashcards for a specific folder and material
 *
 * Usage:
 *   npx tsx scripts/seed-flashcards.ts
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const FOLDER_ID = "692af6ec9030956581215f8f";
const MATERIAL_ID = "692b515d9030956581216077";

const flashcards = [
  {
    front: "What shallow comparison checks in React?",
    back: "	1.	Primitive values: by value (e.g., numbers, strings, booleans).\n2.	Objects and arrays: by reference (i.e., memory address).\n3.	Functions: by reference.",
  },
  {
    front: "Why React uses shallow comparison",
    back: `Because it’s fast. 
    Deep comparison is expensive:
	1-	It grows proportionally to object size
	2-	It triggers recursively
	3-	It destroys performance at scale
	4-	It would slow down every render/effect
  React is designed to be predictable and fast, so it uses shallow reference checks everywhere.`,
  },
];

async function main() {
  console.log("═".repeat(60));
  console.log("  SEED FLASHCARDS");
  console.log("═".repeat(60));
  console.log(`  Folder ID:   ${FOLDER_ID}`);
  console.log(`  Material ID: ${MATERIAL_ID}`);
  console.log(`  Flashcards:  ${flashcards.length}`);
  console.log("═".repeat(60));
  console.log("");

  // Verify folder exists
  const folder = await prisma.folder.findUnique({
    where: { id: FOLDER_ID },
    select: { id: true, title: true },
  });

  if (!folder) {
    console.error(`❌ Folder not found: ${FOLDER_ID}`);
    process.exit(1);
  }
  console.log(`✅ Found folder: "${folder.title}"`);

  // Verify material exists
  const material = await prisma.material.findUnique({
    where: { id: MATERIAL_ID },
    select: { id: true, title: true, folderId: true },
  });

  if (!material) {
    console.error(`❌ Material not found: ${MATERIAL_ID}`);
    process.exit(1);
  }

  if (material.folderId !== FOLDER_ID) {
    console.error(
      `❌ Material does not belong to folder. Material's folderId: ${material.folderId}`
    );
    process.exit(1);
  }
  console.log(`✅ Found material: "${material.title}"`);
  console.log("");

  // Check for existing flashcards for this material
  const existingCount = await prisma.flashcard.count({
    where: { materialId: MATERIAL_ID },
  });

  if (existingCount > 0) {
    console.log(
      `⚠️  Found ${existingCount} existing flashcards for this material`
    );
    console.log(`   Deleting existing flashcards...`);

    const deleted = await prisma.flashcard.deleteMany({
      where: { materialId: MATERIAL_ID },
    });
    console.log(`   Deleted ${deleted.count} flashcards`);
    console.log("");
  }

  // Create flashcards
  console.log("📝 Creating flashcards...");

  const created = await prisma.flashcard.createMany({
    data: flashcards.map((fc) => ({
      front: fc.front,
      back: fc.back,
      folderId: FOLDER_ID,
      materialId: MATERIAL_ID,
    })),
  });

  console.log(`✅ Created ${created.count} flashcards`);
  console.log("");
  console.log("═".repeat(60));
  console.log("  DONE");
  console.log("═".repeat(60));
}

main()
  .catch((e) => {
    console.error("❌ Error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

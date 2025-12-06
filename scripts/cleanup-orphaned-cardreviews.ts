import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function cleanupOrphanedCardReviews() {
  console.log("Finding orphaned CardReview records...\n");

  // Get all CardReviews
  const allCardReviews = await prisma.cardReview.findMany({
    select: { id: true, cardId: true, resourceType: true, userId: true },
  });

  console.log(`Total CardReview records: ${allCardReviews.length}`);

  // Group by resource type
  const flashcardReviews = allCardReviews.filter(
    (cr) => cr.resourceType.toLowerCase() === "flashcard"
  );
  const materialReviews = allCardReviews.filter(
    (cr) => cr.resourceType.toLowerCase() === "material"
  );
  const questionReviews = allCardReviews.filter(
    (cr) => cr.resourceType.toLowerCase() === "question"
  );

  // Get existing flashcard, material, and question IDs
  const existingFlashcards = await prisma.flashcard.findMany({
    select: { id: true },
  });
  const existingMaterials = await prisma.material.findMany({
    select: { id: true },
  });
  const existingQuestions = await prisma.question.findMany({
    select: { id: true },
  });

  const flashcardIds = new Set(existingFlashcards.map((f) => f.id));
  const materialIds = new Set(existingMaterials.map((m) => m.id));
  const questionIds = new Set(existingQuestions.map((q) => q.id));

  // Find orphaned records
  const orphanedFlashcardReviews = flashcardReviews.filter(
    (cr) => !flashcardIds.has(cr.cardId)
  );
  const orphanedMaterialReviews = materialReviews.filter(
    (cr) => !materialIds.has(cr.cardId)
  );
  const orphanedQuestionReviews = questionReviews.filter(
    (cr) => !questionIds.has(cr.cardId)
  );

  const allOrphaned = [
    ...orphanedFlashcardReviews,
    ...orphanedMaterialReviews,
    ...orphanedQuestionReviews,
  ];

  console.log(
    `\nOrphaned flashcard reviews: ${orphanedFlashcardReviews.length}`
  );
  console.log(`Orphaned material reviews: ${orphanedMaterialReviews.length}`);
  console.log(`Orphaned question reviews: ${orphanedQuestionReviews.length}`);
  console.log(`Total orphaned: ${allOrphaned.length}`);

  if (allOrphaned.length === 0) {
    console.log("\n✅ No orphaned records found!");
    return;
  }

  console.log("\nOrphaned records:");
  allOrphaned.forEach((cr) => {
    console.log(
      `  - ${cr.id} (cardId: ${cr.cardId}, type: ${cr.resourceType})`
    );
  });

  // Delete orphaned records
  const orphanedIds = allOrphaned.map((cr) => cr.id);

  const result = await prisma.cardReview.deleteMany({
    where: { id: { in: orphanedIds } },
  });

  console.log(`\n✅ Deleted ${result.count} orphaned CardReview records`);
}

cleanupOrphanedCardReviews()
  .catch(console.error)
  .finally(() => prisma.$disconnect());

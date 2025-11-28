import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function test() {
  const userId = '68a60683031c492736e6b49a';
  const cardId = '69225021f544dac04129c54c';
  const folderId = '692186656e87ba1cdcf63102';
  
  console.log('\n=== Checking specific card ===\n');
  
  const cardReview = await prisma.cardReview.findFirst({
    where: { userId, cardId, folderId }
  });
  
  if (!cardReview) {
    console.log('❌ Card review not found!');
    await prisma.$disconnect();
    return;
  }
  
  console.log('✅ Card review found:');
  console.log(`   ID: ${cardReview.id}`);
  console.log(`   Next Review: ${cardReview.nextReviewAt?.toISOString()}`);
  console.log(`   Suspended: ${cardReview.suspended}`);
  console.log(`   Resource Type: ${cardReview.resourceType}`);
  
  const now = new Date();
  console.log(`\n   Current Time: ${now.toISOString()}`);
  console.log(`   Is Due: ${cardReview.nextReviewAt <= now}`);
  
  // Check if suspended field exists
  console.log(`\n   Has suspended field: ${cardReview.hasOwnProperty('suspended')}`);
  console.log(`   Suspended value: ${JSON.stringify(cardReview.suspended)}`);
  console.log(`   Suspended value type: ${typeof cardReview.suspended}`);
  
  console.log('\n=== Testing queue query WITHOUT suspended filter ===\n');
  const dueCardsNoFilter = await prisma.cardReview.findMany({
    where: {
      userId,
      folderId,
      nextReviewAt: { lte: new Date() },
    },
    take: 20,
  });
  
  console.log(`Found ${dueCardsNoFilter.length} due cards (no suspended filter)`);
  
  console.log('\n=== Testing queue query WITH suspended: false ===\n');
  const dueCards = await prisma.cardReview.findMany({
    where: {
      userId,
      folderId,
      nextReviewAt: { lte: new Date() },
      suspended: false,
    },
    take: 20,
  });
  
  console.log(`Found ${dueCards.length} due cards (with suspended: false)`);
  
  console.log('\n=== Testing queue query WITH suspended: null OR false ===\n');
  const dueCardsWithNull = await prisma.cardReview.findMany({
    where: {
      userId,
      folderId,
      nextReviewAt: { lte: new Date() },
      OR: [
        { suspended: false },
        { suspended: null },
      ]
    },
    take: 20,
  });
  
  console.log(`Found ${dueCardsWithNull.length} due cards (with suspended: null OR false)`);
  
  await prisma.$disconnect();
}

test().catch(e => {
  console.error('Error:', e);
  process.exit(1);
});

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function debugCard() {
  try {
    const userId = '68a60683031c492736e6b49a';
    const cardId = '69225021f544dac04129c54c';
    
    console.log('Current time:', new Date().toISOString());
    console.log('---');
    
    // Find the specific card
    const card = await prisma.cardReview.findFirst({
      where: {
        userId,
        cardId
      }
    });
    
    console.log('Card data:', JSON.stringify(card, null, 2));
    console.log('---');
    
    if (card) {
      console.log('nextReviewAt:', card.nextReviewAt);
      console.log('Is nextReviewAt in past?', card.nextReviewAt <= new Date());
      console.log('suspended:', card.suspended);
      console.log('suspended type:', typeof card.suspended);
      console.log('suspended === false?', card.suspended === false);
      console.log('---');
    }
    
    // Try the exact query from the endpoint
    const now = new Date();
    const dueCards = await prisma.cardReview.findMany({
      where: {
        userId,
        nextReviewAt: { lte: now },
        suspended: false
      },
      orderBy: { nextReviewAt: 'asc' }
    });
    
    console.log(`Found ${dueCards.length} due cards with the endpoint query`);
    if (dueCards.length > 0) {
      console.log('First card:', JSON.stringify(dueCards[0], null, 2));
    }
    console.log('---');
    
    // Try without suspended filter
    const dueCardsNoSuspended = await prisma.cardReview.findMany({
      where: {
        userId,
        nextReviewAt: { lte: now }
      },
      orderBy: { nextReviewAt: 'asc' }
    });
    
    console.log(`Found ${dueCardsNoSuspended.length} due cards WITHOUT suspended filter`);
    console.log('---');
    
    // Check if suspended field exists in schema
    const allUserCards = await prisma.cardReview.findMany({
      where: { userId },
      take: 5
    });
    
    console.log(`Sample of ${allUserCards.length} cards for this user:`);
    allUserCards.forEach((c, i) => {
      console.log(`Card ${i + 1}:`, {
        cardId: c.cardId,
        nextReviewAt: c.nextReviewAt,
        suspended: c.suspended,
        hasOwnProperty: c.hasOwnProperty('suspended')
      });
    });
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

debugCard();

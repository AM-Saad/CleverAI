import { PrismaClient } from '@prisma/client'

// This script inspects existing CardReview rows and sets resourceType based on
// whether the referenced cardId exists in Flashcard or Material collections.
// Run with: node -r ts-node/register scripts/annotate-cardreview-resourcetype.ts

async function main() {
  const prisma = new PrismaClient()
  try {
    // Find all CardReview records to check their resourceType
    const reviews = await prisma.cardReview.findMany({})

    console.log(`Found ${reviews.length} cardReview rows`)
    for (const r of reviews) {
      const cardId = r.cardId

      // check flashcard first
      const flash = await prisma.flashcard.findUnique({ where: { id: cardId } })
      if (flash) {
        await prisma.cardReview.update({ where: { id: r.id }, data: { resourceType: 'flashcard' } })
        console.log(`Marked review ${r.id} as flashcard`)
        continue
      }

      const mat = await prisma.material.findUnique({ where: { id: cardId } })
      if (mat) {
        await prisma.cardReview.update({ where: { id: r.id }, data: { resourceType: 'material' } })
        console.log(`Marked review ${r.id} as material`)
        continue
      }

      console.log(`Could not find resource for review ${r.id} with cardId=${cardId}`)
    }
  } finally {
    await prisma.$disconnect()
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})

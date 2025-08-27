// app/domain/repositories/PrismaCardRepository.ts

import { PrismaClient } from '@prisma/client'
import type { CardRepository } from '~/domain/repositories/CardRepository'

// NOTE:
// If your Prisma model is named `Card` instead of `Flashcard`,
// rename `prisma.flashcard` → `prisma.card` below.
const prisma = new PrismaClient()

export class PrismaCardRepository implements CardRepository {
  async getCard(cardId: string): Promise<{ id: string; folderId: string }> {
    const row = await prisma.flashcard.findUnique({
      where: { id: cardId },
      select: { id: true, folderId: true },
    })
    if (!row) throw new Error(`Flashcard not found: ${cardId}`)
    return { id: row.id, folderId: row.folderId }
  }

  async getCards(cardIds: string[]): Promise<Array<{ id: string; folderId: string }>> {
    if (cardIds.length === 0) return []
    const rows = await prisma.flashcard.findMany({
      where: { id: { in: cardIds } },
      select: { id: true, folderId: true },
    })
    // Optionally ensure input order; Prisma may not preserve it
    const byId = new Map(rows.map(r => [r.id, r]))
    return cardIds
      .map(id => byId.get(id))
      .filter(Boolean)
      .map(r => ({ id: r!.id, folderId: r!.folderId }))
  }
}

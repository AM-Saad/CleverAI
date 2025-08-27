// app/domain/repositories/CardRepository.ts

export interface CardRepository {
  // minimal reads for queue hydration / folder scoping
  getCard(cardId: string): Promise<{ id: string; folderId: string }>
  getCards(cardIds: string[]): Promise<Array<{ id: string; folderId: string }>>
}

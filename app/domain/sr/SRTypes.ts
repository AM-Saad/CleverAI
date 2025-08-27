// Core state tracked per user+card
export type ReviewState = {
  cardId: string
  userId: string
  folderId: string
  repetitions: number
  easeFactor: number     // EF, e.g., default 2.5, floor ~1.3
  intervalDays: number   // I
  nextReviewAt: Date
  lastReviewedAt?: Date
  lastGrade?: number     // 0..5
  suspended?: boolean    // optional flag to exclude from queues
}

// Grading input
export type GradeInput = {
  userId: string
  cardId: string
  grade: 0|1|2|3|4|5
  requestId?: string     // idempotency
  now?: Date             // injectable clock
}

// Queue query
export type QueueQuery = {
  userId: string
  folderId?: string
  limit?: number         // default e.g. 20
  now?: Date
}

export type SRPolicy = {
  defaultEaseFactor: number   // 2.5
  minEaseFactor: number       // 1.3
  firstIntervalDays: number   // 1
  secondIntervalDays: number  // 6
  maxIntervalDays: number     // e.g., 180 for MVP
  dailyNewCap: number         // cap new enrollments/day (optional)
}

export const defaultSRPolicy: SRPolicy = {
  defaultEaseFactor: 2.5,
  minEaseFactor: 1.3,
  firstIntervalDays: 1,
  secondIntervalDays: 6,
  maxIntervalDays: 180,
  dailyNewCap: 10,
}

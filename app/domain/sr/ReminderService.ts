export interface ReminderService {
  // run by a scheduled function (daily or hourly)
  sendDailyReminders(opts?: { now?: Date; minDueCount?: number }): Promise<void>
}

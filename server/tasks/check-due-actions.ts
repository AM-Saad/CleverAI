import { dateKeyInTimeZone } from "@shared/utils/daily-recurrence";
import { projectDailyDay } from "../modules/daily/application/projectDailyDay";
import {
  dueActionReminders,
  type DueActionReminder,
} from "../modules/daily/domain/dueActionReminders";
import { isInQuietHours } from "../utils/timezone";

/**
 * Fires reminders for timed action items whose start time has arrived, honouring
 * the user's general notification preferences (lead time, quiet hours, snooze).
 */
export async function checkDueActions() {
  const now = new Date();
  const results = { processed: 0, notificationsSent: 0, errors: 0, skipped: 0 };

  // Filtered in JS, not in the query: preference rows written before this field
  // existed have no `actionReminderEnabled` key at all, and a Mongo relation
  // filter matches raw documents — it would skip every existing user. Reads do
  // apply the schema default, so the check below sees `true` for those rows.
  const users = await prisma.user.findMany({
    where: { notificationPreferences: { isNot: null } },
    select: { notificationPreferences: true },
  });

  for (const { notificationPreferences: prefs } of users) {
    if (!prefs?.actionReminderEnabled) continue;
    results.processed++;

    try {
      if (prefs.snoozedUntil && prefs.snoozedUntil > now) {
        results.skipped++;
        continue;
      }
      if (
        prefs.quietHoursEnabled &&
        isInQuietHours(
          prefs.timezone,
          prefs.quietHoursStart,
          prefs.quietHoursEnd,
        )
      ) {
        results.skipped++;
        continue;
      }

      const dateKey = dateKeyInTimeZone(now, prefs.timezone);
      const localTime = new Intl.DateTimeFormat("en-GB", {
        timeZone: prefs.timezone,
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      }).format(now);
      const [hour, minute] = localTime.split(":").map(Number);

      const day = await projectDailyDay({
        prisma,
        userId: prefs.userId,
        dateKey,
      });
      const leadMinutes = prefs.actionReminderLeadMinutes ?? 0;
      const due = dueActionReminders({
        day,
        nowMinutes: hour! * 60 + minute!,
        leadMinutes,
      });
      if (!due.length) {
        results.skipped++;
        continue;
      }

      for (const reminder of due) {
        // occurrenceKey is `${actionItemId}:${dateKey}` — unique per day, so this
        // doubles as the "already reminded" marker.
        const alreadySent = await prisma.scheduledNotification.findFirst({
          where: {
            userId: prefs.userId,
            type: "ACTION_DUE",
            cardId: reminder.occurrenceKey,
            sent: true,
          },
          select: { id: true },
        });
        if (alreadySent) continue;

        const record = await prisma.scheduledNotification.create({
          data: {
            userId: prefs.userId,
            type: "ACTION_DUE",
            cardId: reminder.occurrenceKey,
            scheduledFor: now,
            sent: false,
            metadata: { ...reminder, dateKey },
          },
        });

        const sent = await sendActionDueNotification(
          prefs.userId,
          dateKey,
          leadMinutes,
          reminder,
        );
        if (sent) {
          await prisma.scheduledNotification.update({
            where: { id: record.id },
            data: { sent: true, sentAt: new Date() },
          });
          results.notificationsSent++;
        } else {
          results.errors++;
        }
      }
    } catch (userError) {
      console.error(`Action reminder failed for ${prefs.userId}:`, userError);
      results.errors++;
    }
  }

  console.log("Action reminder check completed:", results);
  return { success: true, timestamp: now.toISOString(), results };
}

async function sendActionDueNotification(
  userId: string,
  dateKey: string,
  leadMinutes: number,
  reminder: DueActionReminder,
): Promise<boolean> {
  try {
    const response = await $fetch("/api/notifications/send", {
      method: "POST",
      headers: { "x-cron-secret": process.env.CRON_SECRET_TOKEN || "" },
      body: {
        title: reminder.title,
        message:
          leadMinutes > 0
            ? `Starts at ${reminder.localTime}, in ${leadMinutes} minutes`
            : `Starts now, at ${reminder.localTime}`,
        targetUsers: [userId],
        url: `/day/${dateKey}`,
        tag: `action-due-${reminder.occurrenceKey}`,
        type: "ACTION_DUE",
        requireInteraction: true,
        icon: "/icons/192x192.png",
        persistInApp: true,
        metadata: { ...reminder, dateKey },
      },
    });
    return response.success === true;
  } catch (error) {
    console.error("Error sending action due notification:", error);
    return false;
  }
}

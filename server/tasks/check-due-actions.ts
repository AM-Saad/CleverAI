import { dateKeyInTimeZone } from "@shared/utils/daily-recurrence";
// Imported explicitly rather than relying on Nitro's auto-import: the transform
// silently skipped this file in the production bundle, leaving a bare `prisma`
// that threw "prisma is not defined" on every cron tick while dev worked fine.
import { prisma } from "../utils/prisma";
import { projectDailyDay } from "../modules/daily/application/projectDailyDay";
import {
  dueActionReminders,
  type DueActionReminder,
} from "../modules/daily/domain/dueActionReminders";

/**
 * Fires reminders for timed action items whose start time has arrived.
 *
 * Deliberately ignores quiet hours and snooze, unlike the card reminders: the
 * user picked this time themselves, so a 23:30 item must fire at 23:30. Those
 * settings suppress *our* nudges, not the user's own commitments — and because
 * the fire window is minutes wide with no catch-up, suppressing here would drop
 * the reminder permanently rather than defer it. Opting out is per-item (delete
 * the time) or global (actionReminderEnabled).
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

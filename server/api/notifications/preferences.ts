import { z } from "zod";
import { NotificationPreferencesDTO } from "@@/shared/utils/notification.contract";
import { safeGetServerSession } from "@server/utils/safeGetServerSession";
import { requireRole } from "~~/server/middleware/auth";
import { Errors, success } from "@server/utils/error";

type SessionWithUser = {
  user?: {
    email?: string;
    id?: string;
    [key: string]: unknown;
  };
  [key: string]: unknown;
} | null;

export default defineEventHandler(async (event) => {
  const method = getMethod(event);

  const user = await requireRole(event, ["USER"]); // throws if unauthorized

  // Get user from database to get proper user ID

  const userId = user.id;

  if (method === "GET") {
    let preferences = await prisma.userNotificationPreferences.findUnique({
      where: { userId },
    });

    if (!preferences) {
      preferences = await prisma.userNotificationPreferences.create({
        data: {
          userId,
          cardDueEnabled: true,
          cardDueTime: "09:00",
          cardDueThreshold: 5,
          dailyReminderEnabled: false,
          dailyReminderTime: "19:00",
          timezone: "UTC",
          quietHoursEnabled: false,
          quietHoursStart: "22:00",
          quietHoursEnd: "08:00",
          sendAnytimeOutsideQuietHours: false,
          activeHoursEnabled: false,
          activeHoursStart: "09:00",
          activeHoursEnd: "21:00",
        },
      });
    }

    return success({
      cardDueEnabled: preferences.cardDueEnabled,
      cardDueTime: preferences.cardDueTime,
      cardDueThreshold: preferences.cardDueThreshold,
      dailyReminderEnabled: preferences.dailyReminderEnabled,
      dailyReminderTime: preferences.dailyReminderTime,
      timezone: preferences.timezone,
      quietHoursEnabled: preferences.quietHoursEnabled,
      quietHoursStart: preferences.quietHoursStart,
      quietHoursEnd: preferences.quietHoursEnd,
      sendAnytimeOutsideQuietHours: preferences.sendAnytimeOutsideQuietHours,
      activeHoursEnabled: preferences.activeHoursEnabled,
      activeHoursStart: preferences.activeHoursStart,
      activeHoursEnd: preferences.activeHoursEnd,
    });
  }

  if (method === "PUT") {
    const body = await readBody(event);
    let validatedPrefs;
    try {
      validatedPrefs = NotificationPreferencesDTO.parse(body);
    } catch (err) {
      if (err instanceof z.ZodError) {
        throw Errors.badRequest("Invalid preferences data", err.issues);
      }
      throw Errors.badRequest("Invalid preferences data");
    }

    const preferences = await prisma.userNotificationPreferences.upsert({
      where: { userId },
      update: validatedPrefs,
      create: { userId, ...validatedPrefs },
    });

    return success({
      cardDueEnabled: preferences.cardDueEnabled,
      cardDueTime: preferences.cardDueTime,
      cardDueThreshold: preferences.cardDueThreshold,
      dailyReminderEnabled: preferences.dailyReminderEnabled,
      dailyReminderTime: preferences.dailyReminderTime,
      timezone: preferences.timezone,
      quietHoursEnabled: preferences.quietHoursEnabled,
      quietHoursStart: preferences.quietHoursStart,
      quietHoursEnd: preferences.quietHoursEnd,
      sendAnytimeOutsideQuietHours: preferences.sendAnytimeOutsideQuietHours,
      activeHoursEnabled: preferences.activeHoursEnabled,
      activeHoursStart: preferences.activeHoursStart,
      activeHoursEnd: preferences.activeHoursEnd,
    });
  }

  // 405 - until helper exists, reuse badRequest? We'll add methodNotAllowed soon.
  throw Errors.badRequest("Method not allowed");
});

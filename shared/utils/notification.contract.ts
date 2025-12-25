// shared/utils/notification.contract.ts
import { z } from "zod";

// ==========================================
// Snooze Notification DTO
// ==========================================

export const SnoozeNotificationDTO = z.object({
  duration: z.number().int().min(60).max(86400), // 1 minute to 24 hours in seconds
  timestamp: z.number().optional(),
});
export type SnoozeNotificationDTO = z.infer<typeof SnoozeNotificationDTO>;

// ==========================================
// Push Subscription DTO
// ==========================================

export const PushSubscriptionDTO = z.object({
  endpoint: z.string().url(),
  keys: z.object({
    auth: z.string(),
    p256dh: z.string(),
  }),
  userId: z.string().optional(),
});
export type PushSubscriptionDTO = z.infer<typeof PushSubscriptionDTO>;

// ==========================================
// Unsubscribe DTO
// ==========================================

export const UnsubscribeDTO = z.object({
  endpoint: z.string().url(),
});
export type UnsubscribeDTO = z.infer<typeof UnsubscribeDTO>;

// ==========================================
// Notification Preferences DTO
// ==========================================

const timeRegex = /^\d{2}:\d{2}$/; // HH:MM format

export const NotificationPreferencesDTO = z.object({
  cardDueEnabled: z.boolean(),
  cardDueTime: z.string().regex(timeRegex, "Time must be in HH:MM format"),
  cardDueThreshold: z.number().min(1).max(100),

  dailyReminderEnabled: z.boolean(),
  dailyReminderTime: z
    .string()
    .regex(timeRegex, "Time must be in HH:MM format"),

  timezone: z.string(),
  quietHoursEnabled: z.boolean(),
  quietHoursStart: z.string().regex(timeRegex, "Time must be in HH:MM format"),
  quietHoursEnd: z.string().regex(timeRegex, "Time must be in HH:MM format"),
  sendAnytimeOutsideQuietHours: z.boolean().default(false),
  activeHoursEnabled: z.boolean().default(false),
  activeHoursStart: z.string().regex(timeRegex).default("09:00"),
  activeHoursEnd: z.string().regex(timeRegex).default("21:00"),
});
export type NotificationPreferencesDTO = z.infer<
  typeof NotificationPreferencesDTO
>;

// ==========================================
// Send Notification DTO
// ==========================================

export const SendNotificationDTO = z.object({
  title: z.string().min(1).max(100),
  message: z.string().min(1).max(500),
  icon: z.string().optional(),
  badge: z.string().optional(),
  tag: z.string().optional(),
  requireInteraction: z.boolean().optional(),
  targetUsers: z.array(z.string()).optional(),
  url: z.string().optional(),
});
export type SendNotificationDTO = z.infer<typeof SendNotificationDTO>;

// ==========================================
// Test Notification DTO
// ==========================================

export const TestNotificationDTO = z.object({
  title: z.string().min(1).max(100).default("Test Notification"),
  message: z.string().min(1).max(500).default("This is a test notification"),
  icon: z.string().optional(),
  tag: z.string().optional(),
  requireInteraction: z.boolean().optional(),
  url: z.string().optional(),
});
export type TestNotificationDTO = z.infer<typeof TestNotificationDTO>;

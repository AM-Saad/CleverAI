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
  userAgent: z.string().optional(),
  expirationTime: z.number().nullable().optional(),
});
export type PushSubscriptionDTO = z.infer<typeof PushSubscriptionDTO>;

// ==========================================
// Unsubscribe DTO
// ==========================================

export const UnsubscribeDTO = z
  .object({
    endpoint: z.string().url().optional(),
    subscriptionId: z.string().optional(),
  })
  .refine((value) => value.endpoint || value.subscriptionId, {
    message: "endpoint or subscriptionId is required",
    path: ["endpoint"],
  });
export type UnsubscribeDTO = z.infer<typeof UnsubscribeDTO>;

export const NotificationSubscriptionMutationResponseSchema = z.object({
  message: z.string().optional(),
  deletedCount: z.number().int().nonnegative().optional(),
  subscription: z.unknown().optional(),
});
export type NotificationSubscriptionMutationResponse = z.infer<
  typeof NotificationSubscriptionMutationResponseSchema
>;

export const NotificationSubscriptionListItemSchema = z.object({
  id: z.string(),
  endpoint: z.string(),
  endpointHash: z.string(),
  createdAt: z.union([z.string(), z.date()]),
  expiresAt: z.union([z.string(), z.date()]).nullable().optional(),
  isActive: z.boolean(),
  failureCount: z.number().int().nonnegative(),
  lastSeen: z.union([z.string(), z.date()]).nullable().optional(),
  userAgent: z.string().nullable().optional(),
  deviceInfo: z.unknown().nullable().optional(),
  isCurrentDevice: z.boolean(),
});

export const NotificationSubscriptionsResponseSchema = z.object({
  subscriptions: z.array(NotificationSubscriptionListItemSchema),
});
export type NotificationSubscriptionsResponse = z.infer<
  typeof NotificationSubscriptionsResponseSchema
>;

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
  type: z.string().optional().default("SYSTEM"),
  persistInApp: z.boolean().optional().default(true),
  metadata: z.record(z.string(), z.unknown()).optional(),
});
export type SendNotificationDTO = z.infer<typeof SendNotificationDTO>;

// ==========================================
// Durable in-app notifications
// ==========================================

export const NotificationItemSchema = z.object({
  id: z.string(),
  type: z.string(),
  title: z.string(),
  content: z.string(),
  url: z.string().nullable().optional(),
  isRead: z.boolean(),
  readAt: z.union([z.string(), z.date()]).nullable().optional(),
  pushStatus: z.string().nullable().optional(),
  sentAt: z.union([z.string(), z.date()]),
});
export type NotificationItem = z.infer<typeof NotificationItemSchema>;

export const RecentNotificationsResponseSchema = z.object({
  notifications: z.array(NotificationItemSchema),
  unreadCount: z.number().int().nonnegative(),
});
export type RecentNotificationsResponse = z.infer<
  typeof RecentNotificationsResponseSchema
>;

export const MarkNotificationReadResponseSchema = z.object({
  notificationId: z.string(),
  unreadCount: z.number().int().nonnegative(),
});
export type MarkNotificationReadResponse = z.infer<
  typeof MarkNotificationReadResponseSchema
>;

export const MarkAllNotificationsReadResponseSchema = z.object({
  updatedCount: z.number().int().nonnegative(),
  unreadCount: z.number().int().nonnegative(),
});
export type MarkAllNotificationsReadResponse = z.infer<
  typeof MarkAllNotificationsReadResponseSchema
>;

export const NotificationDeliveryResponseSchema = z.object({
  sent: z.number().int().nonnegative(),
  failed: z.number().int().nonnegative(),
  total: z.number().int().nonnegative(),
  noSubscription: z.number().int().nonnegative(),
});
export type NotificationDeliveryResponse = z.infer<
  typeof NotificationDeliveryResponseSchema
>;

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

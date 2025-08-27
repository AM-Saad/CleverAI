// Notification Types and Interfaces

export interface NotificationPayload {
  title: string
  message: string
  icon?: string
  tag?: string
  requireInteraction?: boolean
  silent?: boolean
  data?: Record<string, unknown>
  url?: string // For click navigation
}

export interface PushNotificationData {
  title: string
  message: string
  icon?: string
  tag?: string
  requireInteraction?: boolean
  silent?: boolean
  data?: Record<string, unknown>
  url?: string
  timestamp?: number
}

export interface NotificationSubscriptionData {
  endpoint: string
  keys: {
    auth: string
    p256dh: string
  }
  userId?: string
}

export interface NotificationSendRequest {
  title: string
  message: string
  icon?: string
  tag?: string
  requireInteraction?: boolean
  targetUsers?: string[]
  url?: string // URL to navigate to when clicked
}

export interface NotificationSendResponse {
  success: boolean
  message: string
  details: {
    sent: number
    failed: number
    total: number
  }
}

export interface NotificationError {
  code: string
  message: string
  context?: Record<string, unknown>
}

export enum NotificationType {
  SYSTEM = 'system',
  FOLDER_UPDATE = 'folder_update',
  QUIZ_REMINDER = 'quiz_reminder',
  STUDY_REMINDER = 'study_reminder',
  ACHIEVEMENT = 'achievement',
  MARKETING = 'marketing'
}

export interface NotificationPreferences {
  enabled: boolean
  types: {
    [NotificationType.SYSTEM]: boolean
    [NotificationType.FOLDER_UPDATE]: boolean
    [NotificationType.QUIZ_REMINDER]: boolean
    [NotificationType.STUDY_REMINDER]: boolean
    [NotificationType.ACHIEVEMENT]: boolean
    [NotificationType.MARKETING]: boolean
  }
  quietHours?: {
    enabled: boolean
    start: string // HH:MM format
    end: string   // HH:MM format
  }
}

// Service Worker Message Types
export interface ServiceWorkerMessage {
  type: 'NOTIFICATION_CLICK' | 'NOTIFICATION_CLOSE' | 'SUBSCRIPTION_CHANGE'
  data?: Record<string, unknown>
}

export interface NotificationClickData {
  url?: string
  action?: string
  tag?: string
  data?: Record<string, unknown>
}

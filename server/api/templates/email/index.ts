// server/templates/email/index.ts
import type { EmailTemplate } from './base'
import { generateVerificationEmail, type VerificationEmailData } from './verification'
import { generateWelcomeEmail, type WelcomeEmailData } from './welcome'
import { generatePasswordResetEmail, type PasswordResetEmailData } from './password-reset'
import { generateNotificationEmail, type NotificationEmailData } from './notification'

// Base utilities
export * from './base'

// Email templates
export * from './verification'
export * from './welcome'
export * from './password-reset'
export * from './notification'

// Template registry for easy access
export const EmailTemplates = {
  verification: generateVerificationEmail,
  welcome: generateWelcomeEmail,
  passwordReset: generatePasswordResetEmail,
  notification: generateNotificationEmail
} as const

export type EmailTemplateType = keyof typeof EmailTemplates

type EmailTemplateDataUnion = VerificationEmailData | WelcomeEmailData | PasswordResetEmailData | NotificationEmailData

/**
 * Centralized template generator with overloads
 */
export function generateEmailTemplate(
  type: 'verification',
  data: VerificationEmailData
): EmailTemplate
export function generateEmailTemplate(
  type: 'welcome',
  data: WelcomeEmailData
): EmailTemplate
export function generateEmailTemplate(
  type: 'passwordReset',
  data: PasswordResetEmailData,
  customResetUrl?: string
): EmailTemplate
export function generateEmailTemplate(
  type: 'notification',
  data: NotificationEmailData,
  options?: { actionText?: string; actionUrl?: string; priority?: 'low' | 'normal' | 'high' }
): EmailTemplate
export function generateEmailTemplate(
  type: EmailTemplateType,
  data: EmailTemplateDataUnion,
  ...args: unknown[]
): EmailTemplate {
  switch (type) {
    case 'verification':
      return generateVerificationEmail(data as VerificationEmailData)
    case 'welcome':
      return generateWelcomeEmail(data as WelcomeEmailData)
    case 'passwordReset':
      return generatePasswordResetEmail(data as PasswordResetEmailData, args[0] as string)
    case 'notification':
      return generateNotificationEmail(
        data as NotificationEmailData,
        args[0] as { actionText?: string; actionUrl?: string; priority?: 'low' | 'normal' | 'high' }
      )
    default:
      throw new Error(`Unknown email template type: ${type}`)
  }
}

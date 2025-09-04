// server/templates/email/notification.ts
import type { EmailTemplate, EmailTemplateData } from './base'
import { generateHeader, generateButton, generateFooter, wrapContent, baseStyles } from './base'

export interface NotificationEmailData extends EmailTemplateData {
  title: string
  message: string
}

/**
 * Generate notification email template
 */
export const generateNotificationEmail = (
  data: NotificationEmailData,
  options?: {
    actionText?: string
    actionUrl?: string
    priority?: 'low' | 'normal' | 'high'
  }
): EmailTemplate => {
  const { title, message } = data
  const { actionText, actionUrl, priority = 'normal' } = options || {}

  // Set color scheme based on priority
  const priorityColors = {
    low: { bg: '#f0f9ff', border: '#2563eb' },
    normal: { bg: '#f8fafc', border: '#6b7280' },
    high: { bg: '#fef2f2', border: '#dc2626' }
  }

  const colors = priorityColors[priority]

  const content = `
    ${generateHeader(title)}

    <div style="background-color: ${colors.bg}; border-left: 4px solid ${colors.border}; ${baseStyles.contentBox}">
      <div style="${baseStyles.text}">
        ${message}
      </div>

      ${actionText && actionUrl ? generateButton(actionText, actionUrl) : ''}
    </div>

    ${generateFooter()}
  `

  const priorityPrefix = priority === 'high' ? '[URGENT] ' : priority === 'low' ? '[INFO] ' : ''

  return {
    subject: `${priorityPrefix}${title} - Ibrahim Learning`,
    html: wrapContent(content)
  }
}

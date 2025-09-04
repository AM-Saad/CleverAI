// server/templates/email/password-reset.ts
import type { EmailTemplate, EmailTemplateData } from './base'
import { generateHeader, generateButton, generateFooter, wrapContent, baseStyles, brandInfo } from './base'

export interface PasswordResetEmailData extends EmailTemplateData {
  resetToken: string
}

/**
 * Generate password reset email template
 */
export const generatePasswordResetEmail = (data: PasswordResetEmailData, customResetUrl?: string): EmailTemplate => {
  const { resetToken } = data
  const finalResetUrl = customResetUrl || `${brandInfo.websiteUrl}/auth/reset-password?token=${resetToken}`

  const content = `
    ${generateHeader('🔒 Password Reset Request')}

    <div style="background-color: #fef2f2; ${baseStyles.contentBox}">
      <h2 style="color: #1f2937; margin-bottom: 15px;">Reset Your Password</h2>
      <p style="${baseStyles.text}">
        We received a request to reset your password for your Ibrahim Learning account. Click the button below to create a new password:
      </p>

      ${generateButton('Reset Password', finalResetUrl, '#dc2626')}

      <p style="color: #6b7280; font-size: 14px; margin-bottom: 0;">
        This password reset link will expire in 1 hour for security purposes.
      </p>
    </div>

    <div style="background-color: #fffbeb; border: 1px solid #fbbf24; border-radius: 6px; padding: 15px; margin-bottom: 20px;">
      <p style="color: #92400e; font-size: 14px; margin: 0;">
        <strong>Security Notice:</strong> If you didn't request a password reset, please ignore this email and your password will remain unchanged.
      </p>
    </div>

    <div style="${baseStyles.footer}">
      <p style="${baseStyles.footerText}">
        If the button doesn't work, copy and paste this link into your browser:
      </p>
      <p style="color: #2563eb; font-size: 12px; word-break: break-all; margin: 5px 0;">
        ${finalResetUrl}
      </p>
    </div>

    ${generateFooter()}
  `

  return {
    subject: 'Reset Your Password - Ibrahim Learning',
    html: wrapContent(content)
  }
}

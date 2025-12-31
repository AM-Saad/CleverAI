// server/templates/email/verification.ts
import type { EmailTemplate, EmailTemplateData } from './base'
import { generateHeader, wrapContent, baseStyles } from './base'

export interface VerificationEmailData extends EmailTemplateData {
  verificationCode: string
}

/**
 * Generate email verification template
 */
export const generateVerificationEmail = (data: VerificationEmailData): EmailTemplate => {
  const { verificationCode } = data

  const content = `
    ${generateHeader('Cognilo', 'Email Verification Required')}

    <div style="background-color: #f8fafc; ${baseStyles.contentBox}">
      <h2 style="color: #1f2937; margin-bottom: 15px;">Verify Your Email Address</h2>
      <p style="${baseStyles.text}">
        Welcome to Cognilo! Please use the verification code below to complete your registration:
      </p>

      <div style="text-align: center; margin: 30px 0;">
        <div style="display: inline-block; background-color: #2563eb; color: white; font-size: 32px; font-weight: bold; padding: 15px 30px; border-radius: 8px; letter-spacing: 4px;">
          ${verificationCode}
        </div>
      </div>

      <p style="color: #6b7280; font-size: 14px; margin-bottom: 0;">
        This verification code will expire in 10 minutes for security purposes.
      </p>
    </div>

    <div style="${baseStyles.footer}">
      <p style="${baseStyles.footerText}">
        If you didn't create an account with Cognilo, please ignore this email.
      </p>
      <p style="${baseStyles.footerText} margin: 5px 0 0 0;">
        This is an automated message, please do not reply to this email.
      </p>
    </div>
  `

  return {
    subject: 'Email Verification - Cognilo',
    html: wrapContent(content)
  }
}

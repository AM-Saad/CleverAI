// server/templates/email/welcome.ts
import type { EmailTemplate, EmailTemplateData } from './base'
import { generateHeader, generateButton, generateFooter, wrapContent, baseStyles, brandInfo } from './base'

export interface WelcomeEmailData extends EmailTemplateData {
  studentName: string
}

/**
 * Generate welcome email template
 */
export const generateWelcomeEmail = (data: WelcomeEmailData): EmailTemplate => {
  const { studentName } = data

  const content = `
    ${generateHeader('Welcome to Ibrahim Learning! 🎓')}

    <div style="background-color: #f0f9ff; ${baseStyles.contentBox}">
      <h2 style="color: #1f2937; margin-bottom: 15px;">Hello ${studentName}!</h2>
      <p style="${baseStyles.text}">
        Congratulations! Your account has been successfully created and verified. You're now ready to start your learning journey with us.
      </p>

      <div style="background-color: white; border-radius: 6px; padding: 20px; margin: 20px 0;">
        <h3 style="color: #2563eb; margin-bottom: 15px;">What's Next?</h3>
        <ul style="color: #4b5563; line-height: 1.6;">
          <li>Browse available chapters and lessons</li>
          <li>Watch educational videos</li>
          <li>Take practice exams</li>
          <li>Track your progress</li>
          <li>Use PIN codes to unlock premium content</li>
        </ul>
      </div>
    </div>

    ${generateButton('Start Learning Now', brandInfo.websiteUrl)}

    ${generateFooter()}
  `

  return {
    subject: 'Welcome to Ibrahim Learning Platform! 🎉',
    html: wrapContent(content)
  }
}

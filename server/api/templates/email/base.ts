// server/templates/email/base.ts

export interface EmailTemplateData {
  [key: string]: string | number | boolean;
}

export interface EmailTemplate {
  subject: string;
  html: string;
}

/**
 * Base email template utilities with common styling and layout
 */
const baseStyles = {
  container:
    "font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;",
  header: "text-align: center; margin-bottom: 30px;",
  title: "color: #2563eb; margin-bottom: 10px;",
  subtitle: "color: #6b7280; font-size: 16px;",
  contentBox: "border-radius: 8px; padding: 30px; margin-bottom: 20px;",
  text: "color: #4b5563; margin-bottom: 20px;",
  button:
    "display: inline-block; color: white; text-decoration: none; padding: 12px 24px; border-radius: 6px; font-weight: bold;",
  footer: "border-top: 1px solid #e5e7eb; padding-top: 20px;",
  footerText: "color: #9ca3af; font-size: 12px; margin: 0;",
};

const brandInfo = {
  name: "Ibrahim Learning Platform",
  supportEmail: "support@ibrahimlearning.com",
  websiteUrl: process.env.APP_BASE_URL || "http://localhost:8080",
};

/**
 * Generate the base wrapper HTML for all emails
 */
export const wrapContent = (content: string): string => {
  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Ibrahim Learning Platform</title>
    </head>
    <body style="margin: 0; padding: 0; background-color: #f3f4f6;">
      <div style="${baseStyles.container}">
        ${content}
      </div>
    </body>
    </html>
  `;
};

/**
 * Generate standard header for emails
 */
export const generateHeader = (title: string, subtitle?: string): string => {
  return `
    <div style="${baseStyles.header}">
      <h1 style="${baseStyles.title}">${title}</h1>
      ${subtitle ? `<p style="${baseStyles.subtitle}">${subtitle}</p>` : ""}
    </div>
  `;
};

/**
 * Generate standard footer for emails
 */
export const generateFooter = (): string => {
  return `
    <div style="${baseStyles.footer}">
      <p style="${baseStyles.footerText}">
        This is an automated message from ${brandInfo.name}. Please do not reply to this email.
      </p>
      <p style="${baseStyles.footerText} margin-top: 5px;">
        Need help? Contact our support team at <a href="mailto:${brandInfo.supportEmail}" style="color: #2563eb;">${brandInfo.supportEmail}</a>
      </p>
    </div>
  `;
};

/**
 * Generate a call-to-action button
 */
export const generateButton = (
  text: string,
  url: string,
  backgroundColor = "#2563eb"
): string => {
  return `
    <div style="text-align: center; margin: 30px 0;">
      <a href="${url}" style="${baseStyles.button} background-color: ${backgroundColor};">
        ${text}
      </a>
    </div>
  `;
};

/**
 * Replace template variables in content
 */
export const replaceVariables = (
  content: string,
  data: EmailTemplateData
): string => {
  let result = content;
  Object.entries(data).forEach(([key, value]) => {
    const regex = new RegExp(`\\{\\{${key}\\}\\}`, "g");
    result = result.replace(regex, String(value));
  });
  return result;
};

/**
 * Export styles and brand info for direct access
 */
export { baseStyles, brandInfo };

// server/utils/resend.server.ts
import { Resend } from "resend";
import { generateEmailTemplate } from "@server/api/templates/email";

// Initialize Resend with API key validation
const initializeResend = () => {
  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey) {
    throw new Error("RESEND_API_KEY environment variable is not set");
  }

  if (!apiKey.startsWith("re_")) {
    throw new Error(
      'RESEND_API_KEY appears to be invalid (should start with "re_")'
    );
  }

  return new Resend(apiKey);
};

const resend = initializeResend();

// Email error types
export enum EmailErrorType {
  VALIDATION_ERROR = "VALIDATION_ERROR",
  NETWORK_ERROR = "NETWORK_ERROR",
  API_ERROR = "API_ERROR",
  RATE_LIMIT_ERROR = "RATE_LIMIT_ERROR",
  AUTHENTICATION_ERROR = "AUTHENTICATION_ERROR",
  TEMPLATE_ERROR = "TEMPLATE_ERROR",
  UNKNOWN_ERROR = "UNKNOWN_ERROR",
}

export class EmailError extends Error {
  public readonly type: EmailErrorType;
  public readonly originalError?: Error | unknown;
  public readonly emailAddress?: string;
  public readonly timestamp: Date;

  constructor(
    message: string,
    type: EmailErrorType,
    originalError?: Error | unknown,
    emailAddress?: string
  ) {
    super(message);
    this.name = "EmailError";
    this.type = type;
    this.originalError = originalError;
    this.emailAddress = emailAddress;
    this.timestamp = new Date();
  }
}

// Email validation helper
const validateEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

// Helper function to determine recipient email based on environment
const getRecipientEmail = (intendedRecipient: string): string => {
  const isDevelopment = process.env.NODE_ENV === "development";
  const testEmail = process.env.RESEND_TEST_EMAIL;

  if (isDevelopment && testEmail) {
    console.log(
      `[RESEND] Development mode: Redirecting email from ${intendedRecipient} to test email ${testEmail}`
    );
    return testEmail;
  }

  return intendedRecipient;
};

// Common email sending function with comprehensive error handling
const sendEmailWithErrorHandling = async (
  emailData: {
    from: string;
    to: string[];
    subject: string;
    html: string;
  },
  emailType: string
): Promise<string> => {
  try {
    // Validate inputs
    if (!emailData.to || emailData.to.length === 0) {
      throw new EmailError(
        "Recipient email address is required",
        EmailErrorType.VALIDATION_ERROR
      );
    }

    // Validate each email address
    for (const email of emailData.to) {
      if (!validateEmail(email)) {
        throw new EmailError(
          `Invalid email address: ${email}`,
          EmailErrorType.VALIDATION_ERROR,
          null,
          email
        );
      }
    }

    if (!emailData.subject?.trim()) {
      throw new EmailError(
        "Email subject is required",
        EmailErrorType.VALIDATION_ERROR
      );
    }

    if (!emailData.html?.trim()) {
      throw new EmailError(
        "Email content is required",
        EmailErrorType.TEMPLATE_ERROR
      );
    }

    // Log email attempt
    console.log(
      `[RESEND] Attempting to send ${emailType} email to:`,
      emailData.to
    );


    // Send email
    const { data, error } = await resend.emails.send(emailData);

    // Handle Resend API errors
    console.log(error);
    if (error) {
      let errorType = EmailErrorType.API_ERROR;
      let errorMessage = error.message || "Unknown Resend API error";

      // Categorize different types of errors
      if (
        error.message?.includes("rate limit") ||
        error.message?.includes("429")
      ) {
        errorType = EmailErrorType.RATE_LIMIT_ERROR;
        errorMessage = "Rate limit exceeded. Please try again later.";
      } else if (
        error.message?.includes("unauthorized") ||
        error.message?.includes("401")
      ) {
        errorType = EmailErrorType.AUTHENTICATION_ERROR;
        errorMessage = "Invalid API key or authentication failed.";
      } else if (
        error.message?.includes("invalid email") ||
        error.message?.includes("400")
      ) {
        errorType = EmailErrorType.VALIDATION_ERROR;
      } else if (
        error.message?.includes("network") ||
        error.message?.includes("timeout")
      ) {
        errorType = EmailErrorType.NETWORK_ERROR;
        errorMessage = "Network error occurred while sending email.";
      }

      throw new EmailError(
        `Failed to send ${emailType} email: ${errorMessage}`,
        errorType,
        error,
        emailData.to[0]
      );
    }

    if (!data?.id) {
      throw new EmailError(
        `Email sent but no confirmation ID received for ${emailType}`,
        EmailErrorType.API_ERROR,
        null,
        emailData.to[0]
      );
    }

    console.log(`[RESEND] ${emailType} email sent successfully:`, {
      id: data.id,
      to: emailData.to,
      timestamp: new Date().toISOString(),
    });

    return data.id;
  } catch (error) {
    // Re-throw EmailError instances
    if (error instanceof EmailError) {
      throw error;
    }

    // Handle unexpected errors
    let errorType = EmailErrorType.UNKNOWN_ERROR;
    let errorMessage = "An unexpected error occurred while sending email";

    if (error instanceof Error) {
      errorMessage = error.message;

      // Categorize based on error message
      if (
        error.message.includes("network") ||
        error.message.includes("fetch")
      ) {
        errorType = EmailErrorType.NETWORK_ERROR;
      } else if (error.message.includes("timeout")) {
        errorType = EmailErrorType.NETWORK_ERROR;
      }
    }

    console.error(`[RESEND] Error sending ${emailType} email:`, {
      error: error,
      to: emailData.to,
      timestamp: new Date().toISOString(),
    });

    throw new EmailError(errorMessage, errorType, error, emailData.to?.[0]);
  }
};

export const sendEmail = async (
  recipientEmail: string,
  verificationCode: string
): Promise<string> => {
  if (!verificationCode?.trim()) {
    throw new EmailError(
      "Verification code is required",
      EmailErrorType.VALIDATION_ERROR,
      null,
      recipientEmail
    );
  }

  const template = generateEmailTemplate("verification", {
    verificationCode,
  });
  const finalRecipient = getRecipientEmail(recipientEmail);

  const emailData = {
    from: "Ibrahim Learning <onboarding@resend.dev>",
    to: [finalRecipient],
    subject: template.subject,
    html: template.html,
  };

  return await sendEmailWithErrorHandling(emailData, "verification");
};

export const sendWelcomeEmail = async (
  recipientEmail: string,
  studentName: string
): Promise<string> => {
  if (!studentName?.trim()) {
    throw new EmailError(
      "Student name is required for welcome email",
      EmailErrorType.VALIDATION_ERROR,
      null,
      recipientEmail
    );
  }

  const template = generateEmailTemplate("welcome", {
    userName: studentName,
    studentName,
  });
  const finalRecipient = getRecipientEmail(recipientEmail);

  const emailData = {
    from: "Ibrahim Learning <welcome@ibrahimlearning.com>",
    to: [finalRecipient],
    subject: template.subject,
    html: template.html,
  };

  return await sendEmailWithErrorHandling(emailData, "welcome");
};

export const sendPasswordResetEmail = async (
  recipientEmail: string,
  resetToken: string
): Promise<string> => {
  if (!resetToken?.trim()) {
    throw new EmailError(
      "Reset token is required for password reset email",
      EmailErrorType.VALIDATION_ERROR,
      null,
      recipientEmail
    );
  }
  console.log("resetToken:", resetToken);
  const template = generateEmailTemplate(
    "passwordReset",
    {
      userName: "User",
      resetToken,
    },
  );
  const finalRecipient = getRecipientEmail(recipientEmail);

  const emailData = {
    from: 'CleverAI <onboarding@resend.dev>',
    to: [finalRecipient],
    subject: template.subject,
    html: template.html,
  };

  return await sendEmailWithErrorHandling(emailData, "password-reset");
};

export const sendNotificationEmail = async (
  recipientEmail: string,
  subject: string,
  message: string,
  userName?: string
): Promise<string> => {
  if (!subject?.trim()) {
    throw new EmailError(
      "Subject is required for notification email",
      EmailErrorType.VALIDATION_ERROR,
      null,
      recipientEmail
    );
  }

  if (!message?.trim()) {
    throw new EmailError(
      "Message is required for notification email",
      EmailErrorType.VALIDATION_ERROR,
      null,
      recipientEmail
    );
  }

  const template = generateEmailTemplate("notification", {
    userName: userName || "User",
    title: subject,
    message,
  });
  const finalRecipient = getRecipientEmail(recipientEmail);

  const emailData = {
    from: "Ibrahim Learning <notifications@ibrahimlearning.com>",
    to: [finalRecipient],
    subject: template.subject,
    html: template.html,
  };

  return await sendEmailWithErrorHandling(emailData, "notification");
};

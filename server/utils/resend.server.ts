// server/utils/resend.server.ts
import { Resend } from "resend";
import { generateEmailTemplate } from "@server/api/templates/email";



/**
 * Lazy, runtime-only Resend singleton
 * - Never runs during build
 * - Never runs during prerender
 */
let resend: Resend | null = null;

function getResend(): Resend {
  if (resend) return resend;

  const { RESEND_API_KEY } = useRuntimeConfig();

  if (!RESEND_API_KEY) {
    throw new Error("RESEND_API_KEY environment variable is not set");
  }

  if (!RESEND_API_KEY.startsWith("re_")) {
    throw new Error('Invalid RESEND_API_KEY (must start with "re_")');
  }

  resend = new Resend(RESEND_API_KEY);
  return resend;
}

/* -------------------------------------------------------------------------- */
/*                                   Errors                                   */
/* -------------------------------------------------------------------------- */

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
  constructor(
    message: string,
    public readonly type: EmailErrorType,
    public readonly originalError?: unknown,
    public readonly emailAddress?: string
  ) {
    super(message);
    this.name = "EmailError";
  }
}

/* -------------------------------------------------------------------------- */
/*                                  Helpers                                   */
/* -------------------------------------------------------------------------- */

const validateEmail = (email: string) =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

const getRecipientEmail = (email: string) => {
  if (process.env.NODE_ENV === "development" && process.env.RESEND_TEST_EMAIL) {
    console.log(
      `[RESEND] Redirecting ${email} → ${process.env.RESEND_TEST_EMAIL}`
    );
    return process.env.RESEND_TEST_EMAIL;
  }
  return email;
};


// Common email sending function with comprehensive error handling
const sendEmailWithErrorHandling = async (
  emailData: {
    from: string
    to: string[]
    subject: string
    html: string
  },
  emailType: string
): Promise<string> => {
  console.log("emailData", emailData);
  try {
    // Validate inputs
    if (!emailData.to || emailData.to.length === 0) {
      throw new EmailError(
        'Recipient email address is required',
        EmailErrorType.VALIDATION_ERROR
      )
    }

    // Validate each email address
    for (const email of emailData.to) {
      if (!validateEmail(email)) {
        throw new EmailError(
          `Invalid email address: ${email}`,
          EmailErrorType.VALIDATION_ERROR,
          null,
          email
        )
      }
    }

    if (!emailData.subject?.trim()) {
      throw new EmailError(
        'Email subject is required',
        EmailErrorType.VALIDATION_ERROR
      )
    }

    if (!emailData.html?.trim()) {
      throw new EmailError(
        'Email content is required',
        EmailErrorType.TEMPLATE_ERROR
      )
    }

    // Log email attempt
    console.log(`[RESEND] Attempting to send ${emailType} email to:`, emailData.to)


    // Send email
    const { data, error } = await getResend().emails.send(emailData)

    // Handle Resend API errors
    console.log(error)
    if (error) {
      let errorType = EmailErrorType.API_ERROR
      let errorMessage = error.message || 'Unknown Resend API error'

      // Categorize different types of errors
      if (error.message?.includes('rate limit') || error.message?.includes('429')) {
        errorType = EmailErrorType.RATE_LIMIT_ERROR
        errorMessage = 'Rate limit exceeded. Please try again later.'
      } else if (error.message?.includes('unauthorized') || error.message?.includes('401')) {
        errorType = EmailErrorType.AUTHENTICATION_ERROR
        errorMessage = 'Invalid API key or authentication failed.'
      } else if (error.message?.includes('invalid email') || error.message?.includes('400')) {
        errorType = EmailErrorType.VALIDATION_ERROR
      } else if (error.message?.includes('network') || error.message?.includes('timeout')) {
        errorType = EmailErrorType.NETWORK_ERROR
        errorMessage = 'Network error occurred while sending email.'
      }

      throw new EmailError(
        `Failed to send ${emailType} email: ${errorMessage}`,
        errorType,
        error,
        emailData.to[0]
      )
    }

    if (!data?.id) {
      throw new EmailError(
        `Email sent but no confirmation ID received for ${emailType}`,
        EmailErrorType.API_ERROR,
        null,
        emailData.to[0]
      )
    }

    console.log(`[RESEND] ${emailType} email sent successfully:`, {
      id: data.id,
      to: emailData.to,
      timestamp: new Date().toISOString()
    })

    return data.id

  } catch (error) {
    console
    // Re-throw EmailError instances
    if (error instanceof EmailError) {
      throw error
    }

    // Handle unexpected errors
    let errorType = EmailErrorType.UNKNOWN_ERROR
    let errorMessage = 'An unexpected error occurred while sending email'

    if (error instanceof Error) {
      errorMessage = error.message

      // Categorize based on error message
      if (error.message.includes('network') || error.message.includes('fetch')) {
        errorType = EmailErrorType.NETWORK_ERROR
      } else if (error.message.includes('timeout')) {
        errorType = EmailErrorType.NETWORK_ERROR
      }
    }

    console.error(`[RESEND] Error sending ${emailType} email:`, {
      error: error,
      to: emailData.to,
      timestamp: new Date().toISOString()
    })

    throw new EmailError(
      errorMessage,
      errorType,
      error,
      emailData.to?.[0]
    )
  }
}

/* -------------------------------------------------------------------------- */
/*                              Core send logic                               */
/* -------------------------------------------------------------------------- */

// async function sendEmailInternal(
//   email: {
//     from: string;
//     to: string[];
//     subject: string;
//     html: string;
//   },
//   type: string
// ): Promise<string> {
//   if (!email.to.length) {
//     throw new EmailError(
//       "Recipient email required",
//       EmailErrorType.VALIDATION_ERROR
//     );
//   }

//   for (const addr of email.to) {
//     if (!validateEmail(addr)) {
//       throw new EmailError(
//         `Invalid email: ${addr}`,
//         EmailErrorType.VALIDATION_ERROR,
//         undefined,
//         addr
//       );
//     }
//   }

//   const { data, error } = await resend.emails.send(email);

//   if (error) {
//     throw new EmailError(
//       `Failed to send ${type} email`,
//       EmailErrorType.API_ERROR,
//       error,
//       email.to[0]
//     );
//   }

//   if (!data?.id) {
//     throw new EmailError(
//       "Email sent but no ID returned",
//       EmailErrorType.API_ERROR,
//       undefined,
//       email.to[0]
//     );
//   }

//   return data.id;
// }

/* -------------------------------------------------------------------------- */
/*                               Public APIs                                  */
/* -------------------------------------------------------------------------- */


export const sendEmail = async (
  recipientEmail: string,
  verificationCode: string,
): Promise<string> => {
  if (!verificationCode?.trim()) {
    throw new EmailError(
      'Verification code is required',
      EmailErrorType.VALIDATION_ERROR,
      null,
      recipientEmail
    )
  }

  const template = generateEmailTemplate('verification', {
    verificationCode
  })
  const finalRecipient = getRecipientEmail(recipientEmail)

  const emailData = {
    from: 'Cognilo <onboarding@resend.dev>',
    to: [finalRecipient],
    subject: template.subject,
    html: template.html,
  }

  return await sendEmailWithErrorHandling(emailData, 'verification')
}

export async function sendWelcomeEmail(
  recipientEmail: string,
  studentName: string
) {
  const template = generateEmailTemplate("welcome", {
    userName: studentName,
    studentName,
  });
  const finalRecipient = getRecipientEmail(recipientEmail)

  return await sendEmailWithErrorHandling(
    {
      from: "Cognilo <onboarding@resend.dev>",
      to: [finalRecipient],
      subject: template.subject,
      html: template.html,
    },
    "welcome"
  );

}

export async function sendPasswordResetEmail(
  recipientEmail: string,
  resetToken: string
) {
  const template = generateEmailTemplate("passwordReset", {
    userName: "User",
    resetToken,
  });
  const finalRecipient = getRecipientEmail(recipientEmail)

  return await sendEmailWithErrorHandling(
    {
      from: "Cognilo <onboarding@resend.dev>",
      to: [finalRecipient],
      subject: template.subject,
      html: template.html,
    },
    "password-reset"
  );
}

export async function sendNotificationEmail(
  recipientEmail: string,
  subject: string,
  message: string,
  userName = "User"
) {
  const template = generateEmailTemplate("notification", {
    userName,
    title: subject,
    message,
  });
  const finalRecipient = getRecipientEmail(recipientEmail)

  return await sendEmailWithErrorHandling(
    {
      from: "Cognilo <onboarding@resend.dev>",
      to: [finalRecipient],
      subject: template.subject,
      html: template.html,
    },
    "notification"
  );
}

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

/* -------------------------------------------------------------------------- */
/*                              Core send logic                               */
/* -------------------------------------------------------------------------- */

async function sendEmailInternal(
  email: {
    from: string;
    to: string[];
    subject: string;
    html: string;
  },
  type: string
): Promise<string> {
  if (!email.to.length) {
    throw new EmailError(
      "Recipient email required",
      EmailErrorType.VALIDATION_ERROR
    );
  }

  for (const addr of email.to) {
    if (!validateEmail(addr)) {
      throw new EmailError(
        `Invalid email: ${addr}`,
        EmailErrorType.VALIDATION_ERROR,
        undefined,
        addr
      );
    }
  }

  const { data, error } = await getResend().emails.send(email);

  if (error) {
    throw new EmailError(
      `Failed to send ${type} email`,
      EmailErrorType.API_ERROR,
      error,
      email.to[0]
    );
  }

  if (!data?.id) {
    throw new EmailError(
      "Email sent but no ID returned",
      EmailErrorType.API_ERROR,
      undefined,
      email.to[0]
    );
  }

  return data.id;
}

/* -------------------------------------------------------------------------- */
/*                               Public APIs                                  */
/* -------------------------------------------------------------------------- */

export async function sendEmail(
  recipientEmail: string,
  verificationCode: string
) {
  const template = generateEmailTemplate("verification", {
    verificationCode,
  });

  return sendEmailInternal(
    {
      from: "Cognilo <onboarding@resend.dev>",
      to: [getRecipientEmail(recipientEmail)],
      subject: template.subject,
      html: template.html,
    },
    "verification"
  );
}

export async function sendWelcomeEmail(
  recipientEmail: string,
  studentName: string
) {
  const template = generateEmailTemplate("welcome", {
    userName: studentName,
    studentName,
  });

  return sendEmailInternal(
    {
      from: "Ibrahim Learning <welcome@ibrahimlearning.com>",
      to: [getRecipientEmail(recipientEmail)],
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

  return sendEmailInternal(
    {
      from: "Cognilo <onboarding@resend.dev>",
      to: [getRecipientEmail(recipientEmail)],
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

  return sendEmailInternal(
    {
      from: "Ibrahim Learning <notifications@ibrahimlearning.com>",
      to: [getRecipientEmail(recipientEmail)],
      subject: template.subject,
      html: template.html,
    },
    "notification"
  );
}

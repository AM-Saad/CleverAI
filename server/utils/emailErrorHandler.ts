// server/utils/emailErrorHandler.ts
export interface EmailErrorResponse {
  success: false;
  error: {
    type: EmailErrorType;
    message: string;
    timestamp: Date;
    emailAddress?: string;
  };
  statusCode: number;
}

export interface EmailSuccessResponse {
  success: true;
  emailId: string;
  message: string;
}

export type EmailResponse = EmailSuccessResponse | EmailErrorResponse;

/**
 * Handles email errors and converts them to appropriate HTTP responses
 * @param error The caught error
 * @param fallbackMessage Default message if error is not an EmailError
 * @returns Structured error response with appropriate HTTP status code
 */
export const handleEmailError = (
  error: unknown,
  fallbackMessage = "Failed to send email"
): EmailErrorResponse => {
  if (error instanceof EmailError) {
    let statusCode = 500;

    switch (error.type) {
      case EmailErrorType.VALIDATION_ERROR:
        statusCode = 400;
        break;
      case EmailErrorType.AUTHENTICATION_ERROR:
        statusCode = 401;
        break;
      case EmailErrorType.RATE_LIMIT_ERROR:
        statusCode = 429;
        break;
      case EmailErrorType.NETWORK_ERROR:
        statusCode = 503;
        break;
      case EmailErrorType.API_ERROR:
      case EmailErrorType.TEMPLATE_ERROR:
      case EmailErrorType.UNKNOWN_ERROR:
      default:
        statusCode = 500;
    }

    return {
      success: false,
      error: {
        type: error.type,
        message: error.message,
        timestamp: error.timestamp,
        emailAddress: error.emailAddress,
      },
      statusCode,
    };
  }

  // Handle generic errors
  return {
    success: false,
    error: {
      type: EmailErrorType.UNKNOWN_ERROR,
      message: fallbackMessage,
      timestamp: new Date(),
    },
    statusCode: 500,
  };
};

/**
 * Creates a successful email response
 * @param emailId The ID of the sent email
 * @param message Success message
 * @returns Structured success response
 */
export const createEmailSuccessResponse = (
  emailId: string,
  message = "Email sent successfully"
): EmailSuccessResponse => ({
  success: true,
  emailId,
  message,
});

/**
 * Wrapper for email operations that handles errors consistently
 * @param emailOperation The email sending function
 * @param successMessage Message to return on success
 * @returns Promise that resolves to EmailResponse
 */
export const wrapEmailOperation = async (
  emailOperation: () => Promise<string>,
  successMessage = "Email sent successfully"
): Promise<EmailResponse> => {
  try {
    const emailId = await emailOperation();
    return createEmailSuccessResponse(emailId, successMessage);
  } catch (error) {
    return handleEmailError(error);
  }
};

/**
 * Logs email operation details for monitoring
 * @param operation Type of email operation
 * @param result The result of the operation
 * @param recipientEmail Optional recipient email for logging
 */
export const logEmailOperation = (
  operation: string,
  result: EmailResponse,
  recipientEmail?: string
): void => {
  const logData = {
    operation,
    success: result.success,
    timestamp: new Date().toISOString(),
    recipientEmail:
      recipientEmail || result.success ? undefined : result.error.emailAddress,
  };

  if (result.success) {
    console.log(`[EMAIL SUCCESS] ${operation}:`, {
      ...logData,
      emailId: result.emailId,
    });
  } else {
    console.error(`[EMAIL ERROR] ${operation}:`, {
      ...logData,
      errorType: result.error.type,
      errorMessage: result.error.message,
    });
  }
};

/**
 * Comprehensive Error Taxonomy for CleverAI
 *
 * This file defines the complete error classification system with:
 * - Specific error codes for client-side handling
 * - Standardized HTTP status mappings
 * - Detailed error categories
 * - User-friendly error messages
 * - Developer error context
 */

export enum ErrorCategory {
  // Input & Validation Errors (4xx)
  VALIDATION = 'VALIDATION',
  AUTHENTICATION = 'AUTHENTICATION',
  AUTHORIZATION = 'AUTHORIZATION',
  RATE_LIMITING = 'RATE_LIMITING',
  QUOTA = 'QUOTA',
  NOT_FOUND = 'NOT_FOUND',
  CONFLICT = 'CONFLICT',

  // Business Logic Errors (4xx)
  BUSINESS_RULE = 'BUSINESS_RULE',
  RESOURCE_STATE = 'RESOURCE_STATE',
  DEPENDENCY = 'DEPENDENCY',

  // External Service Errors (5xx/4xx)
  EXTERNAL_API = 'EXTERNAL_API',
  DATABASE = 'DATABASE',
  EMAIL_SERVICE = 'EMAIL_SERVICE',
  AI_SERVICE = 'AI_SERVICE',

  // System Errors (5xx)
  INTERNAL_SERVER = 'INTERNAL_SERVER',
  CONFIGURATION = 'CONFIGURATION',
  NETWORK = 'NETWORK',
  TIMEOUT = 'TIMEOUT'
}

export enum ErrorCode {
  // === VALIDATION ERRORS (1000-1999) ===
  VALIDATION_FAILED = 'E1000',
  VALIDATION_REQUIRED_FIELD = 'E1001',
  VALIDATION_INVALID_FORMAT = 'E1002',
  VALIDATION_LENGTH_EXCEEDED = 'E1003',
  VALIDATION_LENGTH_TOO_SHORT = 'E1004',
  VALIDATION_INVALID_TYPE = 'E1005',
  VALIDATION_INVALID_ENUM = 'E1006',
  VALIDATION_CUSTOM_RULE = 'E1007',

  // === AUTHENTICATION ERRORS (2000-2999) ===
  AUTH_REQUIRED = 'E2000',
  AUTH_INVALID_CREDENTIALS = 'E2001',
  AUTH_TOKEN_EXPIRED = 'E2002',
  AUTH_TOKEN_INVALID = 'E2003',
  AUTH_SESSION_EXPIRED = 'E2004',
  AUTH_EMAIL_NOT_VERIFIED = 'E2005',
  AUTH_ACCOUNT_DISABLED = 'E2006',
  AUTH_TWO_FACTOR_REQUIRED = 'E2007',

  // === AUTHORIZATION ERRORS (3000-3999) ===
  AUTHZ_INSUFFICIENT_PERMISSIONS = 'E3000',
  AUTHZ_RESOURCE_ACCESS_DENIED = 'E3001',
  AUTHZ_ROLE_REQUIRED = 'E3002',
  AUTHZ_OWNERSHIP_REQUIRED = 'E3003',
  AUTHZ_SUBSCRIPTION_REQUIRED = 'E3004',

  // === RATE LIMITING & QUOTA (4000-4999) ===
  RATE_LIMIT_EXCEEDED = 'E4000',
  RATE_LIMIT_USER_EXCEEDED = 'E4001',
  RATE_LIMIT_IP_EXCEEDED = 'E4002',
  QUOTA_EXCEEDED = 'E4003',
  QUOTA_GENERATION_EXCEEDED = 'E4004',
  QUOTA_STORAGE_EXCEEDED = 'E4005',

  // === RESOURCE ERRORS (5000-5999) ===
  RESOURCE_NOT_FOUND = 'E5000',
  FOLDER_NOT_FOUND = 'E5001',
  MATERIAL_NOT_FOUND = 'E5002',
  FLASHCARD_NOT_FOUND = 'E5003',
  USER_NOT_FOUND = 'E5004',
  REVIEW_NOT_FOUND = 'E5005',

  // === CONFLICT ERRORS (6000-6999) ===
  RESOURCE_CONFLICT = 'E6000',
  DUPLICATE_RESOURCE = 'E6001',
  CONCURRENT_MODIFICATION = 'E6002',
  FOLDER_NOT_EMPTY = 'E6003',
  EMAIL_ALREADY_EXISTS = 'E6004',

  // === BUSINESS LOGIC ERRORS (7000-7999) ===
  BUSINESS_RULE_VIOLATION = 'E7000',
  FOLDER_LIMIT_EXCEEDED = 'E7001',
  CARD_LIMIT_EXCEEDED = 'E7002',
  INVALID_REVIEW_STATE = 'E7003',
  REVIEW_ALREADY_COMPLETED = 'E7004',
  SUBSCRIPTION_REQUIRED = 'E7005',

  // === EXTERNAL SERVICE ERRORS (8000-8999) ===
  EXTERNAL_API_ERROR = 'E8000',
  EXTERNAL_API_UNAVAILABLE = 'E8001',
  EXTERNAL_API_QUOTA_EXCEEDED = 'E8002',
  EMAIL_SEND_FAILED = 'E8010',
  EMAIL_INVALID_ADDRESS = 'E8011',
  AI_GENERATION_FAILED = 'E8020',
  AI_MODEL_UNAVAILABLE = 'E8021',
  AI_CONTENT_FILTERED = 'E8022',

  // === DATABASE ERRORS (9000-9199) ===
  DATABASE_ERROR = 'E9000',
  DATABASE_CONNECTION_FAILED = 'E9001',
  DATABASE_TIMEOUT = 'E9002',
  DATABASE_CONSTRAINT_VIOLATION = 'E9003',
  DATABASE_TRANSACTION_FAILED = 'E9004',

  // === SYSTEM ERRORS (9200-9999) ===
  INTERNAL_SERVER_ERROR = 'E9200',
  CONFIGURATION_ERROR = 'E9201',
  NETWORK_ERROR = 'E9202',
  TIMEOUT_ERROR = 'E9203',
  SERVICE_UNAVAILABLE = 'E9204',
  MAINTENANCE_MODE = 'E9205'
}

export interface ErrorDefinition {
  code: ErrorCode
  category: ErrorCategory
  httpStatus: number
  userMessage: string
  developerMessage: string
  suggestedAction?: string
  retryable: boolean
  severity: 'low' | 'medium' | 'high' | 'critical'
}

// Comprehensive error definitions mapping
export const ERROR_DEFINITIONS: Partial<Record<ErrorCode, ErrorDefinition>> = {
  // === VALIDATION ERRORS ===
  [ErrorCode.VALIDATION_FAILED]: {
    code: ErrorCode.VALIDATION_FAILED,
    category: ErrorCategory.VALIDATION,
    httpStatus: 400,
    userMessage: 'The information provided is not valid. Please check your input and try again.',
    developerMessage: 'Request validation failed. Check the errors array for specific field issues.',
    suggestedAction: 'Review the highlighted fields and correct any errors.',
    retryable: false,
    severity: 'low'
  },

  [ErrorCode.VALIDATION_REQUIRED_FIELD]: {
    code: ErrorCode.VALIDATION_REQUIRED_FIELD,
    category: ErrorCategory.VALIDATION,
    httpStatus: 400,
    userMessage: 'Required fields are missing. Please fill in all required information.',
    developerMessage: 'One or more required fields are missing from the request.',
    suggestedAction: 'Complete all fields marked as required.',
    retryable: false,
    severity: 'low'
  },

  [ErrorCode.VALIDATION_INVALID_FORMAT]: {
    code: ErrorCode.VALIDATION_INVALID_FORMAT,
    category: ErrorCategory.VALIDATION,
    httpStatus: 400,
    userMessage: 'The format of the provided data is incorrect.',
    developerMessage: 'Field format validation failed.',
    suggestedAction: 'Check the format requirements and try again.',
    retryable: false,
    severity: 'low'
  },

  [ErrorCode.VALIDATION_LENGTH_EXCEEDED]: {
    code: ErrorCode.VALIDATION_LENGTH_EXCEEDED,
    category: ErrorCategory.VALIDATION,
    httpStatus: 400,
    userMessage: 'The content is too long. Please reduce the text length and try again.',
    developerMessage: 'Field length exceeds maximum allowed characters.',
    suggestedAction: 'Reduce text length to meet the specified limits.',
    retryable: false,
    severity: 'low'
  },

  [ErrorCode.VALIDATION_LENGTH_TOO_SHORT]: {
    code: ErrorCode.VALIDATION_LENGTH_TOO_SHORT,
    category: ErrorCategory.VALIDATION,
    httpStatus: 400,
    userMessage: 'The content is too short. Please provide more information.',
    developerMessage: 'Field length below minimum required characters.',
    suggestedAction: 'Increase text length to meet the minimum requirements.',
    retryable: false,
    severity: 'low'
  },

  [ErrorCode.VALIDATION_INVALID_TYPE]: {
    code: ErrorCode.VALIDATION_INVALID_TYPE,
    category: ErrorCategory.VALIDATION,
    httpStatus: 400,
    userMessage: 'Invalid data type provided.',
    developerMessage: 'Field type validation failed.',
    suggestedAction: 'Ensure the correct data type is provided.',
    retryable: false,
    severity: 'low'
  },

  [ErrorCode.VALIDATION_INVALID_ENUM]: {
    code: ErrorCode.VALIDATION_INVALID_ENUM,
    category: ErrorCategory.VALIDATION,
    httpStatus: 400,
    userMessage: 'Invalid selection. Please choose from the available options.',
    developerMessage: 'Enum validation failed - value not in allowed set.',
    suggestedAction: 'Select from the available options.',
    retryable: false,
    severity: 'low'
  },

  [ErrorCode.VALIDATION_CUSTOM_RULE]: {
    code: ErrorCode.VALIDATION_CUSTOM_RULE,
    category: ErrorCategory.VALIDATION,
    httpStatus: 400,
    userMessage: 'The provided data does not meet the requirements.',
    developerMessage: 'Custom validation rule failed.',
    suggestedAction: 'Review the specific requirements for this field.',
    retryable: false,
    severity: 'low'
  },

  // === AUTHENTICATION ERRORS ===
  [ErrorCode.AUTH_REQUIRED]: {
    code: ErrorCode.AUTH_REQUIRED,
    category: ErrorCategory.AUTHENTICATION,
    httpStatus: 401,
    userMessage: 'Please log in to continue.',
    developerMessage: 'Authentication required but no valid session found.',
    suggestedAction: 'Please sign in to your account.',
    retryable: false,
    severity: 'medium'
  },

  [ErrorCode.AUTH_INVALID_CREDENTIALS]: {
    code: ErrorCode.AUTH_INVALID_CREDENTIALS,
    category: ErrorCategory.AUTHENTICATION,
    httpStatus: 401,
    userMessage: 'Invalid email or password. Please try again.',
    developerMessage: 'Authentication failed due to invalid credentials.',
    suggestedAction: 'Check your email and password, or reset your password.',
    retryable: true,
    severity: 'low'
  },

  [ErrorCode.AUTH_TOKEN_EXPIRED]: {
    code: ErrorCode.AUTH_TOKEN_EXPIRED,
    category: ErrorCategory.AUTHENTICATION,
    httpStatus: 401,
    userMessage: 'Your session has expired. Please log in again.',
    developerMessage: 'Authentication token has expired.',
    suggestedAction: 'Please sign in again.',
    retryable: false,
    severity: 'medium'
  },

  [ErrorCode.AUTH_TOKEN_INVALID]: {
    code: ErrorCode.AUTH_TOKEN_INVALID,
    category: ErrorCategory.AUTHENTICATION,
    httpStatus: 401,
    userMessage: 'Invalid authentication token. Please log in again.',
    developerMessage: 'Authentication token is malformed or invalid.',
    suggestedAction: 'Please sign in again.',
    retryable: false,
    severity: 'medium'
  },

  [ErrorCode.AUTH_SESSION_EXPIRED]: {
    code: ErrorCode.AUTH_SESSION_EXPIRED,
    category: ErrorCategory.AUTHENTICATION,
    httpStatus: 401,
    userMessage: 'Your session has expired. Please log in again.',
    developerMessage: 'User session has expired.',
    suggestedAction: 'Please sign in again.',
    retryable: false,
    severity: 'medium'
  },

  [ErrorCode.AUTH_EMAIL_NOT_VERIFIED]: {
    code: ErrorCode.AUTH_EMAIL_NOT_VERIFIED,
    category: ErrorCategory.AUTHENTICATION,
    httpStatus: 403,
    userMessage: 'Please verify your email address to continue.',
    developerMessage: 'User account exists but email verification is required.',
    suggestedAction: 'Check your email for verification instructions.',
    retryable: false,
    severity: 'medium'
  },

  [ErrorCode.AUTH_ACCOUNT_DISABLED]: {
    code: ErrorCode.AUTH_ACCOUNT_DISABLED,
    category: ErrorCategory.AUTHENTICATION,
    httpStatus: 403,
    userMessage: 'Your account has been disabled. Please contact support.',
    developerMessage: 'User account is disabled.',
    suggestedAction: 'Contact support for assistance.',
    retryable: false,
    severity: 'high'
  },

  [ErrorCode.AUTH_TWO_FACTOR_REQUIRED]: {
    code: ErrorCode.AUTH_TWO_FACTOR_REQUIRED,
    category: ErrorCategory.AUTHENTICATION,
    httpStatus: 403,
    userMessage: 'Two-factor authentication is required.',
    developerMessage: 'Two-factor authentication step required.',
    suggestedAction: 'Complete two-factor authentication.',
    retryable: false,
    severity: 'medium'
  },

  // === AUTHORIZATION ERRORS ===
  [ErrorCode.AUTHZ_INSUFFICIENT_PERMISSIONS]: {
    code: ErrorCode.AUTHZ_INSUFFICIENT_PERMISSIONS,
    category: ErrorCategory.AUTHORIZATION,
    httpStatus: 403,
    userMessage: 'You do not have permission to perform this action.',
    developerMessage: 'User lacks required permissions for this operation.',
    suggestedAction: 'Contact your administrator if you believe this is an error.',
    retryable: false,
    severity: 'medium'
  },

  [ErrorCode.AUTHZ_RESOURCE_ACCESS_DENIED]: {
    code: ErrorCode.AUTHZ_RESOURCE_ACCESS_DENIED,
    category: ErrorCategory.AUTHORIZATION,
    httpStatus: 403,
    userMessage: 'You cannot access this resource.',
    developerMessage: 'User does not have access to the requested resource.',
    suggestedAction: 'Make sure you have the correct permissions for this resource.',
    retryable: false,
    severity: 'medium'
  },

  [ErrorCode.AUTHZ_ROLE_REQUIRED]: {
    code: ErrorCode.AUTHZ_ROLE_REQUIRED,
    category: ErrorCategory.AUTHORIZATION,
    httpStatus: 403,
    userMessage: 'This action requires a specific role.',
    developerMessage: 'User role does not meet requirements for this operation.',
    suggestedAction: 'Contact administrator for role assignment.',
    retryable: false,
    severity: 'medium'
  },

  [ErrorCode.AUTHZ_OWNERSHIP_REQUIRED]: {
    code: ErrorCode.AUTHZ_OWNERSHIP_REQUIRED,
    category: ErrorCategory.AUTHORIZATION,
    httpStatus: 403,
    userMessage: 'You can only access your own resources.',
    developerMessage: 'Resource ownership verification failed.',
    suggestedAction: 'Make sure you are accessing your own resources.',
    retryable: false,
    severity: 'medium'
  },

  [ErrorCode.AUTHZ_SUBSCRIPTION_REQUIRED]: {
    code: ErrorCode.AUTHZ_SUBSCRIPTION_REQUIRED,
    category: ErrorCategory.AUTHORIZATION,
    httpStatus: 403,
    userMessage: 'This feature requires a subscription upgrade.',
    developerMessage: 'Feature requires higher subscription tier.',
    suggestedAction: 'Upgrade your subscription to access this feature.',
    retryable: false,
    severity: 'medium'
  },

  // === RATE LIMITING & QUOTA ===
  [ErrorCode.RATE_LIMIT_EXCEEDED]: {
    code: ErrorCode.RATE_LIMIT_EXCEEDED,
    category: ErrorCategory.RATE_LIMITING,
    httpStatus: 429,
    userMessage: 'Too many requests. Please wait a moment and try again.',
    developerMessage: 'Rate limit exceeded for this user/IP.',
    suggestedAction: 'Wait a few minutes before making more requests.',
    retryable: true,
    severity: 'medium'
  },

  [ErrorCode.RATE_LIMIT_USER_EXCEEDED]: {
    code: ErrorCode.RATE_LIMIT_USER_EXCEEDED,
    category: ErrorCategory.RATE_LIMITING,
    httpStatus: 429,
    userMessage: 'You are making too many requests. Please slow down.',
    developerMessage: 'User-specific rate limit exceeded.',
    suggestedAction: 'Wait before making more requests.',
    retryable: true,
    severity: 'medium'
  },

  [ErrorCode.RATE_LIMIT_IP_EXCEEDED]: {
    code: ErrorCode.RATE_LIMIT_IP_EXCEEDED,
    category: ErrorCategory.RATE_LIMITING,
    httpStatus: 429,
    userMessage: 'Too many requests from your network. Please try again later.',
    developerMessage: 'IP-based rate limit exceeded.',
    suggestedAction: 'Wait before making more requests.',
    retryable: true,
    severity: 'medium'
  },

  [ErrorCode.QUOTA_EXCEEDED]: {
    code: ErrorCode.QUOTA_EXCEEDED,
    category: ErrorCategory.QUOTA,
    httpStatus: 402,
    userMessage: 'You have reached your usage limit. Please upgrade your plan to continue.',
    developerMessage: 'User has exceeded their subscription quota.',
    suggestedAction: 'Upgrade your subscription or wait for the next billing period.',
    retryable: false,
    severity: 'high'
  },

  [ErrorCode.QUOTA_GENERATION_EXCEEDED]: {
    code: ErrorCode.QUOTA_GENERATION_EXCEEDED,
    category: ErrorCategory.QUOTA,
    httpStatus: 402,
    userMessage: 'You have used all your AI generations for this period.',
    developerMessage: 'AI generation quota exceeded.',
    suggestedAction: 'Upgrade your plan or wait for quota renewal.',
    retryable: false,
    severity: 'high'
  },

  [ErrorCode.QUOTA_STORAGE_EXCEEDED]: {
    code: ErrorCode.QUOTA_STORAGE_EXCEEDED,
    category: ErrorCategory.QUOTA,
    httpStatus: 402,
    userMessage: 'You have reached your storage limit.',
    developerMessage: 'Storage quota exceeded.',
    suggestedAction: 'Delete some content or upgrade your plan.',
    retryable: false,
    severity: 'high'
  },

  // === RESOURCE ERRORS ===
  [ErrorCode.RESOURCE_NOT_FOUND]: {
    code: ErrorCode.RESOURCE_NOT_FOUND,
    category: ErrorCategory.NOT_FOUND,
    httpStatus: 404,
    userMessage: 'The requested item could not be found.',
    developerMessage: 'Requested resource does not exist or has been deleted.',
    suggestedAction: 'Please check the URL or refresh the page.',
    retryable: false,
    severity: 'low'
  },

  [ErrorCode.FOLDER_NOT_FOUND]: {
    code: ErrorCode.FOLDER_NOT_FOUND,
    category: ErrorCategory.NOT_FOUND,
    httpStatus: 404,
    userMessage: 'The folder you are looking for does not exist.',
    developerMessage: 'Folder with specified ID not found.',
    suggestedAction: 'Please check that the folder still exists.',
    retryable: false,
    severity: 'low'
  },

  [ErrorCode.MATERIAL_NOT_FOUND]: {
    code: ErrorCode.MATERIAL_NOT_FOUND,
    category: ErrorCategory.NOT_FOUND,
    httpStatus: 404,
    userMessage: 'The material could not be found.',
    developerMessage: 'Material with specified ID not found.',
    suggestedAction: 'Please check that the material still exists.',
    retryable: false,
    severity: 'low'
  },

  [ErrorCode.FLASHCARD_NOT_FOUND]: {
    code: ErrorCode.FLASHCARD_NOT_FOUND,
    category: ErrorCategory.NOT_FOUND,
    httpStatus: 404,
    userMessage: 'The flashcard could not be found.',
    developerMessage: 'Flashcard with specified ID not found.',
    suggestedAction: 'Please check that the flashcard still exists.',
    retryable: false,
    severity: 'low'
  },

  [ErrorCode.USER_NOT_FOUND]: {
    code: ErrorCode.USER_NOT_FOUND,
    category: ErrorCategory.NOT_FOUND,
    httpStatus: 404,
    userMessage: 'User account not found.',
    developerMessage: 'User with specified identifier not found.',
    suggestedAction: 'Please check the user identifier.',
    retryable: false,
    severity: 'medium'
  },

  [ErrorCode.REVIEW_NOT_FOUND]: {
    code: ErrorCode.REVIEW_NOT_FOUND,
    category: ErrorCategory.NOT_FOUND,
    httpStatus: 404,
    userMessage: 'The review session could not be found.',
    developerMessage: 'Review with specified ID not found.',
    suggestedAction: 'Please check that the review still exists.',
    retryable: false,
    severity: 'low'
  },

  // === CONFLICT ERRORS ===
  [ErrorCode.RESOURCE_CONFLICT]: {
    code: ErrorCode.RESOURCE_CONFLICT,
    category: ErrorCategory.CONFLICT,
    httpStatus: 409,
    userMessage: 'There is a conflict with the current state of the resource.',
    developerMessage: 'Resource conflict detected.',
    suggestedAction: 'Refresh and try again.',
    retryable: true,
    severity: 'medium'
  },

  [ErrorCode.DUPLICATE_RESOURCE]: {
    code: ErrorCode.DUPLICATE_RESOURCE,
    category: ErrorCategory.CONFLICT,
    httpStatus: 409,
    userMessage: 'A resource with this information already exists.',
    developerMessage: 'Duplicate resource creation attempted.',
    suggestedAction: 'Use a different name or update the existing resource.',
    retryable: false,
    severity: 'low'
  },

  [ErrorCode.CONCURRENT_MODIFICATION]: {
    code: ErrorCode.CONCURRENT_MODIFICATION,
    category: ErrorCategory.CONFLICT,
    httpStatus: 409,
    userMessage: 'This resource was modified by another user. Please refresh and try again.',
    developerMessage: 'Concurrent modification conflict detected.',
    suggestedAction: 'Refresh the page and try your changes again.',
    retryable: true,
    severity: 'medium'
  },

  [ErrorCode.FOLDER_NOT_EMPTY]: {
    code: ErrorCode.FOLDER_NOT_EMPTY,
    category: ErrorCategory.CONFLICT,
    httpStatus: 409,
    userMessage: 'Cannot delete folder because it contains items.',
    developerMessage: 'Attempted to delete non-empty folder.',
    suggestedAction: 'Move or delete the contents first.',
    retryable: false,
    severity: 'low'
  },

  [ErrorCode.EMAIL_ALREADY_EXISTS]: {
    code: ErrorCode.EMAIL_ALREADY_EXISTS,
    category: ErrorCategory.CONFLICT,
    httpStatus: 409,
    userMessage: 'An account with this email address already exists.',
    developerMessage: 'Email uniqueness constraint violation.',
    suggestedAction: 'Use a different email address or sign in to the existing account.',
    retryable: false,
    severity: 'low'
  },

  // === BUSINESS LOGIC ERRORS ===
  [ErrorCode.BUSINESS_RULE_VIOLATION]: {
    code: ErrorCode.BUSINESS_RULE_VIOLATION,
    category: ErrorCategory.BUSINESS_RULE,
    httpStatus: 422,
    userMessage: 'This action violates business rules.',
    developerMessage: 'Business rule validation failed.',
    suggestedAction: 'Review the action and requirements.',
    retryable: false,
    severity: 'medium'
  },

  [ErrorCode.FOLDER_LIMIT_EXCEEDED]: {
    code: ErrorCode.FOLDER_LIMIT_EXCEEDED,
    category: ErrorCategory.BUSINESS_RULE,
    httpStatus: 422,
    userMessage: 'You have reached the maximum number of folders allowed.',
    developerMessage: 'Folder limit exceeded for user.',
    suggestedAction: 'Delete some folders or upgrade your plan.',
    retryable: false,
    severity: 'medium'
  },

  [ErrorCode.CARD_LIMIT_EXCEEDED]: {
    code: ErrorCode.CARD_LIMIT_EXCEEDED,
    category: ErrorCategory.BUSINESS_RULE,
    httpStatus: 422,
    userMessage: 'You have reached the maximum number of cards allowed.',
    developerMessage: 'Card limit exceeded for user.',
    suggestedAction: 'Delete some cards or upgrade your plan.',
    retryable: false,
    severity: 'medium'
  },

  [ErrorCode.INVALID_REVIEW_STATE]: {
    code: ErrorCode.INVALID_REVIEW_STATE,
    category: ErrorCategory.BUSINESS_RULE,
    httpStatus: 422,
    userMessage: 'Invalid review state for this operation.',
    developerMessage: 'Review state validation failed.',
    suggestedAction: 'Check the current review state.',
    retryable: false,
    severity: 'medium'
  },

  [ErrorCode.REVIEW_ALREADY_COMPLETED]: {
    code: ErrorCode.REVIEW_ALREADY_COMPLETED,
    category: ErrorCategory.BUSINESS_RULE,
    httpStatus: 422,
    userMessage: 'This review has already been completed.',
    developerMessage: 'Attempted to complete already completed review.',
    suggestedAction: 'Refresh to see the current state.',
    retryable: false,
    severity: 'low'
  },

  [ErrorCode.SUBSCRIPTION_REQUIRED]: {
    code: ErrorCode.SUBSCRIPTION_REQUIRED,
    category: ErrorCategory.BUSINESS_RULE,
    httpStatus: 402,
    userMessage: 'This feature requires a paid subscription.',
    developerMessage: 'Premium feature accessed by free user.',
    suggestedAction: 'Upgrade to a paid plan.',
    retryable: false,
    severity: 'medium'
  },

  // === EXTERNAL SERVICE ERRORS ===
  [ErrorCode.EXTERNAL_API_ERROR]: {
    code: ErrorCode.EXTERNAL_API_ERROR,
    category: ErrorCategory.EXTERNAL_API,
    httpStatus: 502,
    userMessage: 'An external service is currently unavailable.',
    developerMessage: 'External API returned an error.',
    suggestedAction: 'Try again later.',
    retryable: true,
    severity: 'medium'
  },

  [ErrorCode.EXTERNAL_API_UNAVAILABLE]: {
    code: ErrorCode.EXTERNAL_API_UNAVAILABLE,
    category: ErrorCategory.EXTERNAL_API,
    httpStatus: 503,
    userMessage: 'An external service is currently unavailable.',
    developerMessage: 'External API is not responding.',
    suggestedAction: 'Try again later.',
    retryable: true,
    severity: 'high'
  },

  [ErrorCode.EXTERNAL_API_QUOTA_EXCEEDED]: {
    code: ErrorCode.EXTERNAL_API_QUOTA_EXCEEDED,
    category: ErrorCategory.EXTERNAL_API,
    httpStatus: 502,
    userMessage: 'Service temporarily unavailable due to high demand.',
    developerMessage: 'External API quota exceeded.',
    suggestedAction: 'Try again later.',
    retryable: true,
    severity: 'high'
  },

  [ErrorCode.EMAIL_SEND_FAILED]: {
    code: ErrorCode.EMAIL_SEND_FAILED,
    category: ErrorCategory.EMAIL_SERVICE,
    httpStatus: 502,
    userMessage: 'Failed to send email. Please try again later.',
    developerMessage: 'Email service provider returned an error.',
    suggestedAction: 'Try again later or contact support if the issue persists.',
    retryable: true,
    severity: 'high'
  },

  [ErrorCode.EMAIL_INVALID_ADDRESS]: {
    code: ErrorCode.EMAIL_INVALID_ADDRESS,
    category: ErrorCategory.EMAIL_SERVICE,
    httpStatus: 400,
    userMessage: 'Invalid email address provided.',
    developerMessage: 'Email address format validation failed.',
    suggestedAction: 'Please provide a valid email address.',
    retryable: false,
    severity: 'low'
  },

  [ErrorCode.AI_GENERATION_FAILED]: {
    code: ErrorCode.AI_GENERATION_FAILED,
    category: ErrorCategory.AI_SERVICE,
    httpStatus: 502,
    userMessage: 'AI content generation failed. Please try again.',
    developerMessage: 'External AI service returned an error.',
    suggestedAction: 'Try again in a few moments or try a different model.',
    retryable: true,
    severity: 'medium'
  },

  [ErrorCode.AI_MODEL_UNAVAILABLE]: {
    code: ErrorCode.AI_MODEL_UNAVAILABLE,
    category: ErrorCategory.AI_SERVICE,
    httpStatus: 503,
    userMessage: 'The selected AI model is temporarily unavailable.',
    developerMessage: 'AI model service is not responding.',
    suggestedAction: 'Try a different model or wait a few minutes.',
    retryable: true,
    severity: 'medium'
  },

  [ErrorCode.AI_CONTENT_FILTERED]: {
    code: ErrorCode.AI_CONTENT_FILTERED,
    category: ErrorCategory.AI_SERVICE,
    httpStatus: 422,
    userMessage: 'Content could not be generated due to content policy restrictions.',
    developerMessage: 'AI service filtered content due to policy violations.',
    suggestedAction: 'Try with different content that complies with policies.',
    retryable: false,
    severity: 'low'
  },

  // === DATABASE ERRORS ===
  [ErrorCode.DATABASE_ERROR]: {
    code: ErrorCode.DATABASE_ERROR,
    category: ErrorCategory.DATABASE,
    httpStatus: 500,
    userMessage: 'Unable to process your request due to a database issue.',
    developerMessage: 'Database operation failed.',
    suggestedAction: 'Please try again later.',
    retryable: true,
    severity: 'critical'
  },

  [ErrorCode.DATABASE_CONNECTION_FAILED]: {
    code: ErrorCode.DATABASE_CONNECTION_FAILED,
    category: ErrorCategory.DATABASE,
    httpStatus: 500,
    userMessage: 'Unable to connect to the database.',
    developerMessage: 'Database connection failed.',
    suggestedAction: 'Please try again later.',
    retryable: true,
    severity: 'critical'
  },

  [ErrorCode.DATABASE_TIMEOUT]: {
    code: ErrorCode.DATABASE_TIMEOUT,
    category: ErrorCategory.DATABASE,
    httpStatus: 504,
    userMessage: 'The request took too long to process.',
    developerMessage: 'Database operation timed out.',
    suggestedAction: 'Please try again.',
    retryable: true,
    severity: 'high'
  },

  [ErrorCode.DATABASE_CONSTRAINT_VIOLATION]: {
    code: ErrorCode.DATABASE_CONSTRAINT_VIOLATION,
    category: ErrorCategory.DATABASE,
    httpStatus: 409,
    userMessage: 'The operation conflicts with existing data constraints.',
    developerMessage: 'Database constraint violation.',
    suggestedAction: 'Check for conflicts and try again.',
    retryable: false,
    severity: 'medium'
  },

  [ErrorCode.DATABASE_TRANSACTION_FAILED]: {
    code: ErrorCode.DATABASE_TRANSACTION_FAILED,
    category: ErrorCategory.DATABASE,
    httpStatus: 500,
    userMessage: 'Unable to complete the transaction.',
    developerMessage: 'Database transaction failed.',
    suggestedAction: 'Please try again.',
    retryable: true,
    severity: 'high'
  },

  // === SYSTEM ERRORS ===
  [ErrorCode.INTERNAL_SERVER_ERROR]: {
    code: ErrorCode.INTERNAL_SERVER_ERROR,
    category: ErrorCategory.INTERNAL_SERVER,
    httpStatus: 500,
    userMessage: 'Something went wrong on our end. Please try again later.',
    developerMessage: 'Unexpected server error occurred.',
    suggestedAction: 'Please try again later or contact support.',
    retryable: true,
    severity: 'critical'
  },

  [ErrorCode.CONFIGURATION_ERROR]: {
    code: ErrorCode.CONFIGURATION_ERROR,
    category: ErrorCategory.CONFIGURATION,
    httpStatus: 500,
    userMessage: 'Service configuration error.',
    developerMessage: 'Server configuration is invalid.',
    suggestedAction: 'Contact support.',
    retryable: false,
    severity: 'critical'
  },

  [ErrorCode.NETWORK_ERROR]: {
    code: ErrorCode.NETWORK_ERROR,
    category: ErrorCategory.NETWORK,
    httpStatus: 500,
    userMessage: 'Network connectivity issue.',
    developerMessage: 'Network operation failed.',
    suggestedAction: 'Check your connection and try again.',
    retryable: true,
    severity: 'high'
  },

  [ErrorCode.TIMEOUT_ERROR]: {
    code: ErrorCode.TIMEOUT_ERROR,
    category: ErrorCategory.TIMEOUT,
    httpStatus: 504,
    userMessage: 'The request took too long to process.',
    developerMessage: 'Operation timed out.',
    suggestedAction: 'Please try again.',
    retryable: true,
    severity: 'medium'
  },

  [ErrorCode.SERVICE_UNAVAILABLE]: {
    code: ErrorCode.SERVICE_UNAVAILABLE,
    category: ErrorCategory.INTERNAL_SERVER,
    httpStatus: 503,
    userMessage: 'Service is temporarily unavailable.',
    developerMessage: 'Service is down for maintenance or overloaded.',
    suggestedAction: 'Please try again later.',
    retryable: true,
    severity: 'high'
  },

  [ErrorCode.MAINTENANCE_MODE]: {
    code: ErrorCode.MAINTENANCE_MODE,
    category: ErrorCategory.INTERNAL_SERVER,
    httpStatus: 503,
    userMessage: 'Service is currently under maintenance.',
    developerMessage: 'Application is in maintenance mode.',
    suggestedAction: 'Please try again later.',
    retryable: true,
    severity: 'medium'
  }
}

/**
 * Get error definition by error code
 */
export function getErrorDefinition(code: ErrorCode): ErrorDefinition {
  const definition = ERROR_DEFINITIONS[code]
  if (!definition) {
    // Fallback to generic internal server error
    return ERROR_DEFINITIONS[ErrorCode.INTERNAL_SERVER_ERROR]!
  }
  return definition
}

/**
 * Check if an error is retryable based on its definition
 */
export function isRetryableError(code: ErrorCode): boolean {
  return getErrorDefinition(code).retryable
}

/**
 * Get suggested retry delay for retryable errors (in milliseconds)
 */
export function getRetryDelay(code: ErrorCode, attempt: number = 1): number {
  if (!isRetryableError(code)) return 0

  const definition = getErrorDefinition(code)

  // Different retry strategies based on error category
  switch (definition.category) {
    case ErrorCategory.RATE_LIMITING:
      return Math.min(1000 * Math.pow(2, attempt - 1), 30000) // Exponential backoff, max 30s

    case ErrorCategory.EXTERNAL_API:
    case ErrorCategory.AI_SERVICE:
      return Math.min(2000 * attempt, 10000) // Linear backoff, max 10s

    case ErrorCategory.DATABASE:
    case ErrorCategory.INTERNAL_SERVER:
      return Math.min(5000 * attempt, 60000) // Longer delays for system issues, max 60s

    default:
      return 1000 * attempt // Default linear backoff
  }
}

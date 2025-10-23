/**
 * Database Error Handling Examples
 * This demonstrates how different database failures are automatically handled
 */

// Example 1: Connection Failure
// If: await prisma.folder.findFirst({ where: { ... } })
// Throws: { code: 'P1001', message: "Can't reach database server" }
// Results in:
const connectionError = {
  success: false,
  error: {
    code: "DATABASE_CONNECTION_FAILED",
    category: "DATABASE",
    userMessage: "We're having trouble connecting to our servers. Please try again in a moment.",
    httpStatus: 503,
    retryable: true,
    severity: "high"
  }
}

// Example 2: Timeout
// If: Long-running query times out
// Throws: { code: 'P1008', message: "Operations timed out" }
// Results in:
const timeoutError = {
  success: false,
  error: {
    code: "DATABASE_TIMEOUT",
    category: "DATABASE",
    userMessage: "The request is taking longer than expected. Please try again.",
    httpStatus: 504,
    retryable: true,
    severity: "medium"
  }
}

// Example 3: Record Not Found (if using findFirstOrThrow)
// If: await prisma.folder.findFirstOrThrow({ where: { ... } })
// Throws: { code: 'P2025', message: "Record not found" }
// Results in:
const notFoundError = {
  success: false,
  error: {
    code: "RESOURCE_NOT_FOUND",
    category: "NOT_FOUND",
    userMessage: "The requested resource was not found.",
    httpStatus: 404,
    retryable: false,
    severity: "low"
  }
}

// Example 4: Constraint Violation
// If: Creating duplicate record
// Throws: { code: 'P2002', message: "Unique constraint failed" }
// Results in:
const duplicateError = {
  success: false,
  error: {
    code: "DUPLICATE_RESOURCE",
    category: "BUSINESS_LOGIC",
    userMessage: "This resource already exists.",
    httpStatus: 409,
    retryable: false,
    severity: "medium"
  }
}

// Example 5: Generic Database Error
// If: Any other database issue
// Results in:
const genericDbError = {
  success: false,
  error: {
    code: "DATABASE_ERROR",
    category: "DATABASE",
    userMessage: "A database error occurred. Please try again.",
    httpStatus: 500,
    retryable: true,
    severity: "high"
  }
}

export { connectionError, timeoutError, notFoundError, duplicateError, genericDbError }

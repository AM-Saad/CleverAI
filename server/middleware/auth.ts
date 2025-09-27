// server/middleware/auth.ts
import { safeGetServerSession } from "../utils/safeGetServerSession"
import { ErrorFactory } from "../utils/standardErrorHandler"

type SessionWithUser = {
  user?: {
    email?: string
    [key: string]: unknown
  }
  [key: string]: unknown
} | null

export default defineEventHandler(async (event) => {
  // Only protect /api/ endpoints, but NOT /api/auth/*, or /api/test/* (for testing)
  console.log("Auth middleware initialized for:", event.path)

  // Define public endpoints that should not require authentication
  const publicEndpoints = [
    '/api/auth/',
    '/api/test/',
    '/api/notifications/test',        // dev-only testing
    '/api/notifications/send',        // has its own auth logic (cron + session)
    '/api/notifications/debug-cron',  // debug endpoint
    '/api/notifications/cron/',       // cron system endpoints
    '/api/notifications/clear-cooldown', // system endpoint
  ]

  // Check if the current path should be protected
  const shouldProtect = event.path.startsWith("/api/") &&
    !publicEndpoints.some(publicPath => event.path.startsWith(publicPath))

  if (shouldProtect) {
    console.log("Auth middleware triggered for:", event.path)
    try {
      await requireAuth(event)
    } catch (error) {
      console.error("Auth middleware error:", error)
      // Let the global error handler process authentication errors
      throw error
    }
  } else {
    console.log("Auth middleware skipped for public endpoint:", event.path)
  }
  // Otherwise, allow public access
})

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function requireAuth(event: any): Promise<any> {
  const session = await safeGetServerSession(event) as SessionWithUser
  if (!session || !session.user || !session.user.email) {
    console.error("Unauthorized access attempt:", event.path)
    ErrorFactory.unauthorized("Authentication required")
    return // This will never execute due to ErrorFactory.unauthorized throwing, but satisfies TypeScript
  }

  // Now TypeScript knows session is valid
  const email = session.user.email

  const prisma = event.context.prisma
  const user = await prisma.user.findUnique({
    where: { email },
  })
  if (!user) {
    ErrorFactory.unauthorized("User account not found")
  }
  event.context.user = user
  return user
}

type UserRole = "USER" | "ADMIN";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function requireRole(event: any, roles: UserRole[]): Promise<any> {
  const user = event.context.user || (await requireAuth(event))
  if (!roles.includes(user.role)) {
    ErrorFactory.forbidden("User does not have the required role")
  }
  return user
}

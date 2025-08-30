// server/middleware/auth.ts
import { getServerSession } from "#auth"
import { ErrorFactory, ErrorType } from "~/services/ErrorFactory"

export default defineEventHandler(async (event) => {
  // Only protect /api/ endpoints, but NOT /api/auth/*, /api/notifications/*, or /api/test/* (for testing)
  console.log("Auth middleware initialized for:", event.path)
  if (
    event.path.startsWith("/api/") &&
    !event.path.startsWith("/api/auth/") &&
    !event.path.startsWith("/api/notifications/") &&
    !event.path.startsWith("/api/test/")
  ) {
    console.log("Auth middleware triggered for:", event.path)
    await requireAuth(event)
  }
  // Otherwise, allow public access
})

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function requireAuth(event: any): Promise<any> {
  const session = await getServerSession(event)
  if (!session || !session.user || !session.user.email) {
    setResponseStatus(event, 401)
    console.error("Unauthorized access attempt:", event.path)
    throw new Error("Unauthorized.")
  }
  const prisma = event.context.prisma
  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
  })
  if (!user) {
    setResponseStatus(event, 401)
    throw new Error("Unauthorized.")
  }
  event.context.user = user
  return user
}

type UserRole = "USER" | "ADMIN";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function requireRole(event: any, roles: UserRole[]): Promise<any> {
  const user = event.context.user || (await requireAuth(event))
  if (!roles.includes(user.role)) {
    setResponseStatus(event, 403)
      throw ErrorFactory.create(
          ErrorType.Auth,
          "Folders",
          "User does not have the required role",
        )
  }
  return user
}

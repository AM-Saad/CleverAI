// server/utils/auth.ts
import { safeGetServerSession } from "../utils/safeGetServerSession";
import { Errors } from "../utils/error";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function requireAuth(event: any): Promise<any> {
  try {
    const session = (await safeGetServerSession(event)) as {
      user?: {
        id?: unknown;
        sub?: unknown;
        email?: unknown;
        [key: string]: unknown;
      };
      [key: string]: unknown;
    } | null;

    if (!session?.user) {
      throw Errors.unauthorized("Authentication required");
    }

    const sessionId =
      typeof session.user.id === "string"
        ? session.user.id
        : typeof session.user.sub === "string"
          ? session.user.sub
          : null;
    const email =
      typeof session.user.email === "string" ? session.user.email : null;
    if (!sessionId && !email) {
      throw Errors.unauthorized("Authentication required");
    }

    const prisma = event.context.prisma;
    // Current JWTs carry the immutable database id. Only legacy sessions that
    // predate that claim fall back to email; an id that no longer exists must
    // not silently authenticate a newly-created account with the same email.
    const user = sessionId
      ? await prisma.user.findUnique({ where: { id: sessionId } })
      : await prisma.user.findUnique({ where: { email } });
    if (!user) {
      throw Errors.sessionInvalid("User account not found");
    }
    event.context.user = user;
    return user;
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("Error in requireAuth:", error);
    throw error;
  }
}

export type UserRole = "USER" | "ADMIN";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function requireRole(event: any, roles: UserRole[]): Promise<any> {
  const user = event.context.user || (await requireAuth(event));
  if (!roles.includes(user.role)) {
    throw Errors.forbidden("User does not have the required role");
  }
  return user;
}

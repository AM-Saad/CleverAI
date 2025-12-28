// server/utils/auth.ts
import { safeGetServerSession } from "../utils/safeGetServerSession";
import { Errors } from "../utils/error";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function requireAuth(event: any): Promise<any> {
  try {
    const session = (await safeGetServerSession(event)) as {
      user?: { email?: string;[key: string]: unknown };
      [key: string]: unknown;
    } | null;

    if (!session || !session.user || !session.user.email) {
      throw Errors.unauthorized("Authentication required");
    }

    const email = session.user.email;
    const prisma = event.context.prisma;
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      throw Errors.unauthorized("User account not found");
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
  console.log("User role:", user.role);
  if (!roles.includes(user.role)) {
    throw Errors.forbidden("User does not have the required role");
  }
  return user;
}

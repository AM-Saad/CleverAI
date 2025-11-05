import { safeGetServerSession } from "../../utils/safeGetServerSession";
import { Errors } from "../../utils/error";

type SessionWithUser = {
  user?: {
    email?: string;
    [key: string]: unknown;
  };
  [key: string]: unknown;
} | null;

export default defineEventHandler(async (event) => {
  try {
    // Check for authenticated session
    const session = (await safeGetServerSession(event)) as SessionWithUser;
    if (!session || !session.user || !session.user.email) {
      throw Errors.unauthorized("Authentication required");
    }

    // Get Prisma client from context
    const prisma = event.context.prisma;

    // Check if user exists
    const existingUser = await prisma.user.findUnique({
      where: { email: session.user.email },
    });

    if (!existingUser) {
      throw Errors.notFound("User not found");
    }

    // Check if account is soft deleted and can be reactivated
    if (!existingUser.deletedAt) {
      throw Errors.badRequest("Account is not deleted");
    }

    const now = new Date();
    
    // Check if scheduled deletion date has passed
    if (existingUser.scheduledDeletionAt && existingUser.scheduledDeletionAt <= now) {
      throw Errors.forbidden("Account deletion period has expired. Cannot reactivate.");
    }

    // Reactivate the account
    const reactivatedUser = await prisma.user.update({
      where: { email: session.user.email },
      data: {
        deletedAt: null,
        scheduledDeletionAt: null,
        updatedAt: now,
      },
    });

    // Remove sensitive data
    const { password, ...userWithoutPassword } = reactivatedUser;

    return {
      success: true,
      data: {
        success: true,
        message: "Account reactivated successfully",
        user: userWithoutPassword,
      },
    };
  } catch (error: unknown) {
    console.error("Error reactivating user account:", error);

    // Re-throw API errors
    if (error && typeof error === "object" && "statusCode" in error) {
      throw error;
    }

    // Generic error
    throw Errors.server("Failed to reactivate account");
  }
});

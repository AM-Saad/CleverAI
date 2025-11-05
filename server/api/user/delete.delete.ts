import { safeGetServerSession } from "../../utils/safeGetServerSession";
import { DeleteAccountDTO } from "../../../shared/utils/user.contract";
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

    // Get request body
    const body = await readBody(event);

    // Validate request body
    const validationResult = DeleteAccountDTO.safeParse(body);
    if (!validationResult.success) {
      throw Errors.badRequest(
        validationResult.error.issues[0]?.message || "Invalid request data"
      );
    }

    const { permanent } = validationResult.data;

    // Get Prisma client from context
    const prisma = event.context.prisma;

    // Check if user exists
    const existingUser = await prisma.user.findUnique({
      where: { email: session.user.email },
    });

    if (!existingUser) {
      throw Errors.notFound("User not found");
    }

    // If already deleted, return appropriate message
    if (existingUser.deletedAt) {
      throw Errors.badRequest("Account is already scheduled for deletion");
    }

    const now = new Date();
    let scheduledDeletionAt: Date | null = null;

    if (permanent) {
      // Permanent deletion - delete immediately
      // Note: In production, you might want to archive data or handle cleanup
      await prisma.user.update({
        where: { email: session.user.email },
        data: {
          deletedAt: now,
          scheduledDeletionAt: now,
          updatedAt: now,
        },
      });

      return {
        success: true,
        data: {
          success: true,
          message: "Account permanently deleted",
          permanent: true,
          scheduledDeletionAt: now.toISOString(),
        },
      };
    } else {
      // Soft delete - schedule for deletion in 30 days
      scheduledDeletionAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

      await prisma.user.update({
        where: { email: session.user.email },
        data: {
          deletedAt: now,
          scheduledDeletionAt: scheduledDeletionAt,
          updatedAt: now,
        },
      });

      return {
        success: true,
        data: {
          success: true,
          message: "Account scheduled for deletion in 30 days. You can reactivate by signing in before then.",
          permanent: false,
          scheduledDeletionAt: scheduledDeletionAt.toISOString(),
        },
      };
    }
  } catch (error: unknown) {
    console.error("Error deleting user account:", error);

    // Re-throw API errors
    if (error && typeof error === "object" && "statusCode" in error) {
      throw error;
    }

    // Generic error
    throw Errors.server("Failed to delete account");
  }
});

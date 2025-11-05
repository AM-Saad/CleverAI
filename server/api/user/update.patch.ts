import { safeGetServerSession } from "../../utils/safeGetServerSession";
import { UpdateProfileDTO } from "../../../shared/utils/user.contract";
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
    const validationResult = UpdateProfileDTO.safeParse(body);
    if (!validationResult.success) {
      throw Errors.badRequest(
        validationResult.error.issues[0]?.message || "Invalid request data"
      );
    }

    const updateData = validationResult.data;

    // Get Prisma client from context
    const prisma = event.context.prisma;

    // Check if user exists and is not deleted
    const existingUser = await prisma.user.findUnique({
      where: { email: session.user.email },
    });

    if (!existingUser) {
      throw Errors.notFound("User not found");
    }

    if (existingUser.deletedAt) {
      throw Errors.forbidden("Cannot update deleted account");
    }

    // Check if phone number is being changed and if it's already in use
    if (updateData.phone && updateData.phone !== existingUser.phone) {
      const phoneExists = await prisma.user.findUnique({
        where: { phone: updateData.phone },
      });

      if (phoneExists) {
        throw Errors.conflict("Phone number already in use");
      }
    }

    // Update user profile
    const updatedUser = await prisma.user.update({
      where: { email: session.user.email },
      data: {
        ...(updateData.name && { name: updateData.name }),
        ...(updateData.phone && { phone: updateData.phone }),
        ...(updateData.gender !== undefined && { gender: updateData.gender }),
        updatedAt: new Date(),
      },
    });

    // Remove sensitive data
    const { password, ...userWithoutPassword } = updatedUser;

    return {
      success: true,
      data: {
        success: true,
        user: userWithoutPassword,
        message: "Profile updated successfully",
      },
    };
  } catch (error: unknown) {
    console.error("Error updating user profile:", error);

    // Re-throw API errors
    if (error && typeof error === "object" && "statusCode" in error) {
      throw error;
    }

    // Generic error
    throw Errors.server("Failed to update profile");
  }
});

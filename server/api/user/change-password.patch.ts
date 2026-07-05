import bcrypt from "bcryptjs";
import { safeGetServerSession } from "../../utils/safeGetServerSession";
import { ChangePasswordDTO } from "../../../shared/utils/user.contract";
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
    const session = (await safeGetServerSession(event)) as SessionWithUser;
    if (!session?.user?.email) {
      throw Errors.unauthorized("Authentication required");
    }

    const body = await readBody(event);
    const parsed = ChangePasswordDTO.safeParse(body);
    if (!parsed.success) {
      throw Errors.badRequest(
        parsed.error.issues[0]?.message || "Invalid password data",
      );
    }

    const prisma = event.context.prisma;
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
    });

    if (!user) throw Errors.notFound("User not found");
    if (user.deletedAt) throw Errors.forbidden("Cannot update deleted account");
    if (!user.password || user.auth_provider !== "credentials") {
      throw Errors.badRequest(
        "Password changes are only available for email/password accounts.",
      );
    }

    const currentPasswordValid = await bcrypt.compare(
      parsed.data.currentPassword,
      user.password,
    );
    if (!currentPasswordValid) {
      throw Errors.badRequest("Current password is incorrect");
    }

    const hashedPassword = await bcrypt.hash(parsed.data.newPassword, 10);
    await prisma.user.update({
      where: { email: session.user.email },
      data: {
        password: hashedPassword,
        updatedAt: new Date(),
      },
    });

    return {
      success: true,
      data: {
        success: true,
        message: "Password changed successfully",
      },
    };
  } catch (error: unknown) {
    console.error("Error changing password:", error);
    if (error && typeof error === "object" && "statusCode" in error) {
      throw error;
    }
    throw Errors.server("Failed to change password");
  }
});

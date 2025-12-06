import { z } from "zod";
import { UnsubscribeDTO } from "@@/shared/utils/notification.contract";
import { safeGetServerSession } from "@server/utils/safeGetServerSession";
import { Errors, success } from "@server/utils/error";

type SessionWithUser = {
  user?: {
    email?: string;
    id?: string;
    [key: string]: unknown;
  };
  [key: string]: unknown;
} | null;

export default defineEventHandler(async (event) => {
  const raw = await readBody(event);
  let parsed;
  try {
    parsed = UnsubscribeDTO.parse(raw);
  } catch (e) {
    if (e instanceof z.ZodError) {
      throw Errors.badRequest(
        "Invalid unsubscribe data",
        e.issues.map((issue) => ({ path: issue.path, message: issue.message }))
      );
    }
    throw Errors.badRequest("Invalid unsubscribe data");
  }

  const session = (await safeGetServerSession(event)) as SessionWithUser;
  if (!session?.user?.email) {
    throw Errors.unauthorized("Must be logged in to unsubscribe");
  }

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
  });
  if (!user) {
    throw Errors.unauthorized("User not found");
  }

  let deletedSubscription;
  try {
    deletedSubscription = await prisma.notificationSubscription.deleteMany({
      where: { endpoint: parsed.endpoint, userId: user.id },
    });
  } catch {
    throw Errors.server("Failed to remove subscription");
  }

  if (deletedSubscription.count === 0) {
    return success({ message: "Subscription not found or already removed" });
  }

  return success({
    message: "Subscription removed successfully",
    removedCount: deletedSubscription.count,
  });
});

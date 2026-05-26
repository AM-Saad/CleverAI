import { z } from "zod";
import { UnsubscribeDTO } from "@@/shared/utils/notification.contract";
import { Errors, success } from "@server/utils/error";
import { requireRole } from "~~/server/utils/auth";

export default defineEventHandler(async (event) => {
  const prisma = event.context.prisma;
  const raw = await readBody(event);
  let parsed;
  try {
    parsed = UnsubscribeDTO.parse(raw);
  } catch (e) {
    if (e instanceof z.ZodError) {
      throw Errors.badRequest(
        "Invalid unsubscribe data",
        e.issues.map((issue) => ({ path: issue.path, message: issue.message })),
      );
    }
    throw Errors.badRequest("Invalid unsubscribe data");
  }

  const user = await requireRole(event, ["USER"]);

  let deletedSubscription;
  try {
    deletedSubscription = await prisma.notificationSubscription.deleteMany({
      where: {
        userId: user.id,
        ...(parsed.endpoint ? { endpoint: parsed.endpoint } : {}),
        ...(parsed.subscriptionId ? { id: parsed.subscriptionId } : {}),
      },
    });
  } catch {
    throw Errors.server("Failed to remove subscription");
  }

  if (deletedSubscription.count === 0) {
    return success({ message: "Subscription not found or already removed" });
  }

  return success({
    message: "Subscription removed successfully",
    deletedCount: deletedSubscription.count,
  });
});

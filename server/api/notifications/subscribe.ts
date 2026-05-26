import { z } from "zod";
import { PushSubscriptionDTO } from "@@/shared/utils/notification.contract";
import { Errors, success } from "@server/utils/error";
import { requireRole } from "~~/server/utils/auth";

export default defineEventHandler(async (event) => {
  let body: unknown;
  try {
    const prisma = event.context.prisma;
    body = await readBody(event);

    const subscription = PushSubscriptionDTO.parse(body);
    const user = await requireRole(event, ["USER"]);
    const now = new Date();
    const userAgent =
      subscription.userAgent || getHeader(event, "user-agent") || undefined;
    const expiresAt =
      typeof subscription.expirationTime === "number"
        ? new Date(subscription.expirationTime)
        : null;

    const existingSubscription =
      await prisma.notificationSubscription.findUnique({
        where: { endpoint: subscription.endpoint },
        select: { id: true, userId: true },
      });

    if (existingSubscription) {
      if (
        existingSubscription.userId &&
        existingSubscription.userId !== user.id
      ) {
        throw Errors.conflict(
          "This browser subscription is already linked to another account",
        );
      }

      const savedSubscription = await prisma.notificationSubscription.update({
        where: { id: existingSubscription.id },
        data: {
          keys: subscription.keys,
          userId: user.id,
          isActive: true,
          failureCount: 0,
          lastSeen: now,
          userAgent,
          expiresAt,
        },
      });

      return success(savedSubscription, {
        message: "Subscription refreshed",
      });
    }

    const savedSubscription = await prisma.notificationSubscription.create({
      data: {
        endpoint: subscription.endpoint,
        keys: subscription.keys,
        userId: user.id,
        isActive: true,
        failureCount: 0,
        lastSeen: now,
        userAgent,
        expiresAt,
      },
    });

    return success(savedSubscription, { message: "Subscription saved" });
  } catch (error: unknown) {
    console.error("Failed to save subscription:", error);
    if (error && typeof error === "object" && "statusCode" in error) {
      throw error;
    }
    if (error instanceof z.ZodError) {
      throw Errors.badRequest("Invalid subscription data", {
        issues: error.issues,
        received: body,
      });
    }
    throw Errors.server("Failed to save subscription");
  }
});

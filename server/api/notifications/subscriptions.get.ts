import { createHash } from "node:crypto";
import { success } from "@server/utils/error";
import { requireRole } from "~~/server/utils/auth";

function hashEndpoint(endpoint: string) {
  return createHash("sha256").update(endpoint).digest("hex");
}

function maskEndpoint(endpoint: string) {
  return `${endpoint.slice(0, 28)}...${endpoint.slice(-12)}`;
}

type SubscriptionListItem = {
  id: string;
  endpoint: string;
  createdAt: Date;
  expiresAt: Date | null;
  isActive: boolean;
  failureCount: number;
  lastSeen: Date | null;
  userAgent: string | null;
  deviceInfo: unknown;
};

export default defineEventHandler(async (event) => {
  const prisma = event.context.prisma;
  const user = await requireRole(event, ["USER"]);
  const query = getQuery(event);
  const currentEndpointHash =
    typeof query.currentEndpointHash === "string"
      ? query.currentEndpointHash
      : null;

  const subscriptions = await prisma.notificationSubscription.findMany({
    where: { userId: user.id },
    select: {
      id: true,
      endpoint: true,
      createdAt: true,
      expiresAt: true,
      isActive: true,
      failureCount: true,
      lastSeen: true,
      userAgent: true,
      deviceInfo: true,
    },
    orderBy: { createdAt: "desc" },
  });

  const maskedSubscriptions = (subscriptions as SubscriptionListItem[]).map(
    (sub) => {
      const endpointHash = hashEndpoint(sub.endpoint);

      return {
        ...sub,
        endpoint: maskEndpoint(sub.endpoint),
        endpointHash,
        isCurrentDevice: currentEndpointHash
          ? endpointHash === currentEndpointHash
          : false,
      };
    },
  );

  return success(
    { subscriptions: maskedSubscriptions },
    { total: subscriptions.length },
  );
});

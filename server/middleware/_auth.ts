// ~~/server/utils/auth.ts

type SessionWithUser = {
  user?: {
    email?: string;
    [key: string]: unknown;
  };
  [key: string]: unknown;
} | null;

export default defineEventHandler(async (event) => {
  // Only protect /api/ endpoints, but NOT /api/auth/*, or /api/test/* (for testing)
  console.log("Auth middleware initialized for:", event.path);

  // Define public endpoints that should not require authentication
  const publicEndpoints = [
    "/api/auth",
    "/api/auth/",
    "/api/auth/session",
    "/api/auth/login",
    "/api/auth/register",
    "/api/auth/password/forgot",
    "/api/auth/password/create",
    "/api/auth/password/verify",

    "/api/test/",
    "/api/debug",
    "/api/notifications/test", // dev-only testing
    "/api/notifications/send", // has its own auth logic (cron + session)
    "/api/notifications/debug-cron", // debug endpoint
    "/api/notifications/cron/", // cron system endpoints
    "/api/notifications/clear-cooldown", // system endpoint
    "/api/ai-worker", // AI worker script (public asset)
    "/api/_nuxt_icon/", // Nuxt icon module (public asset)
  ];

  // Check if the current path should be protected
  const shouldProtect =
    event.path.startsWith("/api/") &&
    !publicEndpoints.some((publicPath) => event.path.startsWith(publicPath));

  if (shouldProtect) {
    console.log("Auth middleware triggered for:", event.path);
  } else {
    console.log("Auth middleware skipped for public endpoint:", event.path);
  }
  // Otherwise, allow public access
});

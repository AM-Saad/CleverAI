// server/api/debug.config.ts
export default defineEventHandler(async () => {
  const users = await prisma.user.findMany({ take: 5 });
  console.log("Sample users from database:", users);
  return {
    authOrigin: useRuntimeConfig().public.AUTH_ORIGIN,
    appBaseUrl: useRuntimeConfig().public.APP_BASE_URL,
    sampleUsers: users,
  };
});

// server/api/debug.config.ts
export default defineEventHandler(() => {
  return {
    authOrigin: useRuntimeConfig().public.AUTH_ORIGIN,
    appBaseUrl: useRuntimeConfig().public.APP_BASE_URL,
  };
});

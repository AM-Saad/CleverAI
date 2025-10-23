// plugins/auth-error-handler.client.ts
export default defineNuxtPlugin({
  name: "auth-error-handler",
  setup(nuxtApp) {
    // Simple auth error logging for development
    nuxtApp.hook("app:error", (error: unknown) => {
      const err = error as Error;

      // Log auth-related errors for debugging
      if (
        err.message?.includes("Unauthorized") ||
        err.message?.includes("401") ||
        err.message?.includes("session")
      ) {
        if (process.env.NODE_ENV === "development") {
          console.warn("Auth error detected:", err.message);
        }

        // Clear any stale auth tokens on auth errors
        if (import.meta.client && err.message?.includes("Unauthorized")) {
          try {
            localStorage.removeItem("auth-token");
            sessionStorage.removeItem("auth-session");
          } catch {
            // Storage might not be available
          }
        }
      }
    });
  },
});

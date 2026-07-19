// plugins/auth-error-handler.client.ts
import { useOfflineRuntime } from "~/composables/offline/useOfflineRuntime";

export default defineNuxtPlugin({
  name: "auth-error-handler",
  setup(nuxtApp) {
    const auth = useAuth();
    const offline = useOfflineRuntime();
    let recoveryPromise: Promise<void> | null = null;

    function recoverInvalidSession() {
      if (recoveryPromise) return recoveryPromise;
      recoveryPromise = (async () => {
        try {
          // Revoke offline access for a server-invalidated identity while
          // retaining its entity/outbox records for later recovery.
          await offline.forgetOfflineIdentity();
          await auth.signOut({ redirect: false });
        } finally {
          // Drop SSR/useAsyncData memory so no account-scoped response can
          // survive into the next login. Durable IndexedDB data is preserved.
          clearNuxtData();
          await navigateTo("/auth/signin?reason=session_invalid", {
            replace: true,
          });
          recoveryPromise = null;
        }
      })();
      return recoveryPromise;
    }

    function onSessionInvalidated() {
      void recoverInvalidSession();
    }

    watch(
      auth.data,
      (session) => {
        const user = session?.user as
          | { sessionInvalidated?: unknown }
          | undefined;
        if (user?.sessionInvalidated === true) {
          void recoverInvalidSession();
        }
      },
      { immediate: true },
    );

    window.addEventListener(
      "auth-session-invalidated",
      onSessionInvalidated,
    );
    onScopeDispose(() => {
      window.removeEventListener(
        "auth-session-invalidated",
        onSessionInvalidated,
      );
    });

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

import type { ComponentPublicInstance } from "vue";

export default defineNuxtPlugin((nuxtApp) => {
  console.log("🔧 [ERROR HANDLER PLUGIN] Initializing error handler plugin");

  nuxtApp.vueApp.config.errorHandler = (
    error: unknown,
    instance: ComponentPublicInstance | null,
    info: string,
  ) => {
    // Enhanced error logging with component details
    console.group("🚨 Global Vue Error Handler");
    console.error("Error:", error);
    console.error("Info:", info);

    if (instance) {
      const componentName =
        instance.$.type?.name || instance.$.type?.__name || "Unknown";
      console.error("Component:", componentName);
      console.error("Component Props:", instance.$props);
    }

    // Handle specific skeleton/slot rendering errors
    if (
      error instanceof Error &&
      error.message?.includes("Cannot read properties of null") &&
      info === "render function"
    ) {
      console.warn(
        "💀 Skeleton/Slot rendering error detected - this might be a timing issue with component initialization",
      );
      console.warn(
        "💡 Suggestion: Check if slots are properly guarded with v-if or provide default content",
      );
    }

    console.groupEnd();

    // Send to error reporting service in production
    if (import.meta.env.PROD) {
      // TODO: Send to error reporting service (Sentry, LogRocket, etc.)
    }
  };

  // Vue error hook with enhanced debugging
  nuxtApp.hook(
    "vue:error",
    (
      error: unknown,
      instance: ComponentPublicInstance | null,
      info: string,
    ) => {
      console.group("🔧 Vue Error Hook");
      console.error("Error:", error);
      console.error("Info:", info);

      if (instance) {
        console.error("Component Element:", instance.$el);
        const componentName =
          instance.$.type?.name || instance.$.type?.__name || "Unknown";
        console.error("Component Name:", componentName);
      }

      // Check for common Vue 3 issues
      if (error instanceof Error && error.message?.includes("renderSlot")) {
        console.warn(
          "⚠️ Slot rendering issue - check for proper slot usage and v-if conditions",
        );
        console.warn("🔍 Common fixes:");
        console.warn(
          "  - Ensure slots have fallback content: <slot>Default content</slot>",
        );
        console.warn(
          "  - Guard conditional slots: <template v-if='condition'><slot /></template>",
        );
        console.warn("  - Check parent component slot usage");
      }

      console.groupEnd();
    },
  );

  nuxtApp.hook("app:error", (error: Error) => {
    console.group("📱 App Error Handler");
    console.error("Error:", error);
    console.error("Stack:", error.stack);
    console.groupEnd();
  });

  // Add unhandled promise rejection handler
  if (import.meta.client) {
    console.log(
      "🔧 [ERROR HANDLER PLUGIN] Setting up client-side error handlers",
    );
    window.addEventListener(
      "unhandledrejection",
      (event: PromiseRejectionEvent) => {
        console.group("❌ Unhandled Promise Rejection");
        console.error("Reason:", event.reason);
        console.error("Promise:", event.promise);
        console.groupEnd();

        // Prevent the default browser behavior
        event.preventDefault();
      },
    );
  }

  console.log(
    "🔧 [ERROR HANDLER PLUGIN] Error handler plugin initialized successfully",
  );
});

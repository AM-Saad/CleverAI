// Global reactive state (singleton)
const globalState = {
  updateAvailable: ref(false),
  isUpdating: ref(false),
  updateError: ref<string | null>(null),
  refreshing: ref(false),
};

export function useServiceWorkerUpdates() {
  // Use the global state instead of creating new refs
  const updateAvailable = globalState.updateAvailable;
  const isUpdating = globalState.isUpdating;
  const updateError = globalState.updateError;
  const refreshing = globalState.refreshing;

  let waitingWorker: ServiceWorker | null = null;
  let registration: ServiceWorkerRegistration | null = null;

  // Development mode utilities
  const isDev = import.meta.dev;

  // Dev mode: Force service worker update
  const forceServiceWorkerUpdate = async () => {
    if (!isDev) {
      console.warn(
        "forceServiceWorkerUpdate is only available in development mode",
      );
      return;
    }

    try {
      console.log("🔄 [DEV] Forcing service worker update...");

      // First, unregister all existing service workers
      const registrations = await navigator.serviceWorker.getRegistrations();
      for (const registration of registrations) {
        console.log("🔄 [DEV] Unregistering:", registration.scope);
        await registration.unregister();
      }

      // Clear all caches
      const cacheNames = await caches.keys();
      await Promise.all(cacheNames.map((name) => caches.delete(name)));
      console.log("🔄 [DEV] Cleared all caches");

      // Force reload to re-register service worker
      console.log(
        "🔄 [DEV] Forcing page reload to re-register service worker...",
      );
      setTimeout(() => {
        window.location.reload();
      }, 500);
    } catch (error) {
      console.error("❌ [DEV] Error updating service worker:", error);
    }
  };

  // Dev mode: Force service worker to take control
  const forceServiceWorkerControl = async () => {
    if (!isDev) {
      console.warn(
        "forceServiceWorkerControl is only available in development mode",
      );
      return;
    }

    try {
      console.log("🔄 [DEV] Forcing service worker control...");
      const registration = await navigator.serviceWorker.ready;

      if (registration.waiting) {
        registration.waiting.postMessage({ type: "SKIP_WAITING" });
        console.log("🔄 [DEV] Told waiting service worker to skip waiting");
      }

      if (registration.active && !navigator.serviceWorker.controller) {
        registration.active.postMessage({ type: "CLAIM_CONTROL" });
        console.log("🔄 [DEV] Told active service worker to claim control");

        setTimeout(() => {
          if (navigator.serviceWorker.controller) {
            console.log("✅ [DEV] Service worker now controlling the page");
          } else {
            console.log(
              "⚠️ [DEV] Service worker still not controlling - try refreshing manually",
            );
          }
        }, 1000);
      } else if (navigator.serviceWorker.controller) {
        console.log("✅ [DEV] Service worker already controlling the page");
      }
    } catch (error) {
      console.error("❌ [DEV] Error forcing service worker control:", error);
    }
  };

  // Dev mode: Manual refresh
  const manualRefresh = () => {
    if (!isDev) {
      console.warn("manualRefresh is only available in development mode");
      return;
    }

    console.log("🔄 [DEV] Manual refresh...");
    window.location.reload();
  };

  // Dev mode: Debug service worker state
  const debugServiceWorker = async () => {
    if (!isDev) {
      console.warn("debugServiceWorker is only available in development mode");
      return;
    }

    try {
      console.log("🔍 [DEV] Debugging service worker...");
      console.log("🔍 [DEV] Navigator serviceWorker:", navigator.serviceWorker);
      console.log("🔍 [DEV] Controller:", navigator.serviceWorker.controller);
      console.log("🔍 [DEV] Ready state:", await navigator.serviceWorker.ready);

      const registrations = await navigator.serviceWorker.getRegistrations();
      console.log("🔍 [DEV] All registrations:", registrations);

      if (navigator.serviceWorker.controller) {
        console.log(
          "🔍 [DEV] Controller script URL:",
          navigator.serviceWorker.controller.scriptURL,
        );
        console.log(
          "🔍 [DEV] Controller state:",
          navigator.serviceWorker.controller.state,
        );
      }
    } catch (error) {
      console.error("❌ [DEV] Error debugging service worker:", error);
    }
  };

  // Dev mode: Test service worker message passing
  const testServiceWorkerMessage = async () => {
    if (!isDev) {
      console.warn(
        "testServiceWorkerMessage is only available in development mode",
      );
      return;
    }

    try {
      console.log("🔔 [DEV] Testing service worker message...");

      if (!navigator.serviceWorker.controller) {
        console.error("❌ [DEV] No service worker controller");
        return;
      }

      navigator.serviceWorker.controller.postMessage({
        type: "TEST_NOTIFICATION_CLICK",
        data: { url: "/about" },
      });

      console.log("✅ [DEV] Test message sent to service worker");
    } catch (error) {
      console.error("❌ [DEV] Error sending message to service worker:", error);
    }
  };

  // Dev mode: Simulate update available
  const simulateUpdateAvailable = () => {
    if (!isDev) {
      console.warn(
        "simulateUpdateAvailable is only available in development mode",
      );
      return;
    }

    console.log("🎭 [DEV] Simulating update available...");
    updateAvailable.value = true;
    console.log("✅ [DEV] Update banner should now appear");
  };

  // Dev mode: Reset update state
  const resetUpdateState = () => {
    if (!isDev) {
      console.warn("resetUpdateState is only available in development mode");
      return;
    }

    console.log("🔄 [DEV] Resetting update state...");
    updateAvailable.value = false;
    isUpdating.value = false;
    updateError.value = null;
    refreshing.value = false;
    waitingWorker = null;
    console.log("✅ [DEV] Update state reset");
  };

  const checkForUpdates = async () => {
    if (!("serviceWorker" in navigator)) {
      console.warn("Service Worker not supported");
      return;
    }

    try {
      registration = await navigator.serviceWorker.ready;
      console.log("🔄 Checking for service worker updates...");
      console.log("🔍 Current registration state:", {
        installing: !!registration.installing,
        waiting: !!registration.waiting,
        active: !!registration.active,
        controller: !!navigator.serviceWorker.controller,
      });

      // Skip update checks for dev-sw or non-/sw.js scripts to avoid MIME/type errors
      const scriptUrl =
        registration.active?.scriptURL ||
        registration.waiting?.scriptURL ||
        registration.installing?.scriptURL ||
        "";
      if (scriptUrl.includes("dev-sw.js") || !scriptUrl.includes("/sw.js")) {
        console.warn("⚠️ Skipping update() for non-custom SW:", scriptUrl);
        return;
      }

      // Check for updates
      await registration.update();
      console.log("🔄 Service worker update check complete");

      // Check if there's a waiting worker after the update
      if (registration.waiting) {
        console.log("📦 Update available, waiting for user action");
        waitingWorker = registration.waiting;
        updateAvailable.value = true;
      } else if (registration.installing) {
        console.log("📦 Service worker installing, checking when ready...");
        // Wait for the installing service worker to finish installing
        registration.installing.addEventListener("statechange", (event) => {
          const worker = event.target as ServiceWorker;
          if (worker.state === "installed") {
            console.log("📦 New service worker installed and waiting");
            waitingWorker = worker;
            updateAvailable.value = true;
          }
        });
      } else {
        console.log("✅ No updates available");
      }
    } catch (error) {
      console.error("❌ Error checking for updates:", error);
      updateError.value =
        error instanceof Error ? error.message : "Update check failed";
    }
  };

  const applyUpdate = async () => {
    if (!waitingWorker) {
      console.warn("No waiting service worker to update");
      return;
    }

    try {
      isUpdating.value = true;
      updateError.value = null;

      console.log("🔄 Applying service worker update...");

      // Tell the waiting worker to skip waiting and activate
      waitingWorker.postMessage({ type: "SKIP_WAITING" });

      // Wait for the new worker to control the page
      await new Promise<void>((resolve) => {
        const handleControllerChange = () => {
          console.log("✅ New service worker is now controlling");
          navigator.serviceWorker.removeEventListener(
            "controllerchange",
            handleControllerChange,
          );
          resolve();
        };

        navigator.serviceWorker.addEventListener(
          "controllerchange",
          handleControllerChange,
        );

        // Fallback timeout
        setTimeout(() => {
          navigator.serviceWorker.removeEventListener(
            "controllerchange",
            handleControllerChange,
          );
          resolve();
        }, 5000);
      });

      // Reset state
      updateAvailable.value = false;
      waitingWorker = null;

      // Refresh the page to use the new service worker
      console.log("🔄 Refreshing page to use updated service worker...");
      refreshing.value = true;

      // Small delay to show loading state
      setTimeout(() => {
        window.location.reload();
      }, 500);
    } catch (error) {
      console.error("❌ Error applying update:", error);
      updateError.value =
        error instanceof Error ? error.message : "Update failed";
    } finally {
      isUpdating.value = false;
    }
  };

  const dismissUpdate = () => {
    console.log("📦 Update dismissed by user");
    updateAvailable.value = false;
    waitingWorker = null;
  };

  const setupUpdateListeners = () => {
    if (!("serviceWorker" in navigator)) return;

    // Listen for new service worker installations
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      console.log("🔄 Service worker controller changed");

      // If we're not already refreshing, this might be an unexpected change
      if (!refreshing.value) {
        console.log("🔄 Unexpected controller change, checking for updates...");
        checkForUpdates();
      }
    });

    // Listen for messages from service worker
    navigator.serviceWorker.addEventListener("message", (event) => {
      if (event.data?.type === "SW_UPDATE_AVAILABLE") {
        console.log("📦 Service worker announced update available");
        updateAvailable.value = true;
      }
    });

    // Set up periodic update checks (every 5 minutes)
    const updateInterval = setInterval(
      () => {
        if (!updateAvailable.value && !isUpdating.value) {
          checkForUpdates();
        }
      },
      5 * 60 * 1000,
    ); // 5 minutes

    // Clean up interval on unmount
    onUnmounted(() => {
      clearInterval(updateInterval);
    });
  };

  // Initialize on mount
  onMounted(() => {
    setupUpdateListeners();
    // Initial check after a short delay
    setTimeout(checkForUpdates, 1000);
  });

  return {
    updateAvailable,
    isUpdating,
    updateError,
    refreshing,
    checkForUpdates,
    applyUpdate,
    dismissUpdate,
    // Dev mode functions (only available in development)
    ...(isDev && {
      forceServiceWorkerUpdate,
      forceServiceWorkerControl,
      manualRefresh,
      debugServiceWorker,
      testServiceWorkerMessage,
      simulateUpdateAvailable,
      resetUpdateState,
    }),
  };
}

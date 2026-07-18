import { defineNuxtPlugin } from "#app";
import {
  getAllServiceWorkerRegistrations,
  getCurrentServiceWorkerRegistration,
  hasServiceWorkerSupport,
  isServiceWorkerRuntimeEnabled,
} from "~/utils/serviceWorkerRuntime";
import { SW_CONFIG } from "~/utils/constants/pwa";

// Registers the custom service worker at /sw.js and migrates away from any lingering dev-sw.
export default defineNuxtPlugin(() => {
  if (!hasServiceWorkerSupport()) return;

  // Single runtime toggle: when disabled, dev should actively unregister
  // lingering registrations so behavior stays deterministic.
  if (!isServiceWorkerRuntimeEnabled()) {
    getAllServiceWorkerRegistrations().then((registrations) => {
      for (const registration of registrations) {
        registration.unregister().then((success) => {
          if (success)
            console.log(
              "[SW] Unregistered service worker because runtime SW is disabled",
            );
        });
      }
    });
    return;
  }

  const SW_URL = `/sw.js?syncProtocol=${encodeURIComponent(SW_CONFIG.SYNC_PROTOCOL)}`;
  const watchedRegistrations = new WeakSet<ServiceWorkerRegistration>();
  let criticalReloadArmed = false;
  const protocolOf = (worker: ServiceWorker | null | undefined) => {
    if (!worker) return null;
    try {
      return new URL(worker.scriptURL).searchParams.get("syncProtocol");
    } catch {
      return null;
    }
  };
  const activateCriticalProtocolUpgrade = (reg: ServiceWorkerRegistration) => {
    const waiting = reg.waiting;
    if (!waiting) return;
    const activeProtocol = protocolOf(
      navigator.serviceWorker.controller ?? reg.active,
    );
    const waitingProtocol = protocolOf(waiting);
    if (
      waitingProtocol === SW_CONFIG.SYNC_PROTOCOL &&
      activeProtocol !== SW_CONFIG.SYNC_PROTOCOL
    ) {
      if (!criticalReloadArmed) {
        criticalReloadArmed = true;
        navigator.serviceWorker.addEventListener(
          "controllerchange",
          () => window.location.reload(),
          { once: true },
        );
      }
      waiting.postMessage({ type: "SKIP_WAITING" });
    }
  };
  const watchCriticalProtocolUpgrade = (reg: ServiceWorkerRegistration) => {
    activateCriticalProtocolUpgrade(reg);
    if (watchedRegistrations.has(reg)) return;
    watchedRegistrations.add(reg);
    reg.addEventListener("updatefound", () => {
      const installing = reg.installing;
      installing?.addEventListener("statechange", () => {
        if (installing.state === "installed") {
          activateCriticalProtocolUpgrade(reg);
        }
      });
    });
  };
  const isDevSW = (reg: ServiceWorkerRegistration | null | undefined) =>
    !!reg &&
    (reg.active?.scriptURL.includes("dev-sw.js") ||
      reg.waiting?.scriptURL?.includes("dev-sw.js") ||
      reg.installing?.scriptURL?.includes("dev-sw.js"));

  const registerCustom = async () => {
    try {
      const registration = await navigator.serviceWorker.register(SW_URL);
      watchCriticalProtocolUpgrade(registration);
    } catch (err) {
      console.error("[SW] register error:", err);
    }
  };

  const init = async () => {
    try {
      // Get the registration controlling this page's scope
      const reg = await getCurrentServiceWorkerRegistration();

      if (!reg) {
        await registerCustom();
        return;
      }

      if (isDevSW(reg)) {
        // Unregister old dev-sw and switch to custom sw
        try {
          await reg.unregister();
        } catch (e) {
          console.warn("[SW] unregister dev-sw failed:", e);
        }
        await registerCustom();
        return;
      }

      watchCriticalProtocolUpgrade(reg);

      // If it's not our /sw.js yet, ensure it's registered
      const currentUrl =
        reg.active?.scriptURL ||
        reg.waiting?.scriptURL ||
        reg.installing?.scriptURL ||
        "";
      if (
        !currentUrl.includes("/sw.js") ||
        protocolOf(reg.active ?? reg.waiting ?? reg.installing) !==
          SW_CONFIG.SYNC_PROTOCOL
      ) {
        await registerCustom();
      }
    } catch (err) {
      console.warn("[SW] registration check failed:", err);
      // Best effort
      await registerCustom();
    }
  };

  // Try immediately and also after load for maximum reliability
  init();
  window.addEventListener("load", init);
});

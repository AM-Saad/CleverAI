import { defineNuxtPlugin } from "#app";
// Registers the custom service worker at /sw.js and migrates away from any lingering dev-sw.
export default defineNuxtPlugin(() => {
  // ✅ Do not register SW during dev/HMR. Prevents Workbox errors for dev URLs.
  if (!import.meta.env.PROD) return;

  if (!("serviceWorker" in navigator)) return;

  const SW_URL = "/sw.js";
  const isDevSW = (reg: ServiceWorkerRegistration | null | undefined) =>
    !!reg &&
    (reg.active?.scriptURL.includes("dev-sw.js") ||
      reg.waiting?.scriptURL?.includes("dev-sw.js") ||
      reg.installing?.scriptURL?.includes("dev-sw.js"));

  const registerCustom = async () => {
    try {
      await navigator.serviceWorker.register(SW_URL);
    } catch (err) {
      console.error("[SW] register error:", err);
    }
  };

  const init = async () => {
    try {
      // Get the registration controlling this page's scope
      const reg = await navigator.serviceWorker.getRegistration();

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

      // If it's not our /sw.js yet, ensure it's registered
      const currentUrl =
        reg.active?.scriptURL ||
        reg.waiting?.scriptURL ||
        reg.installing?.scriptURL ||
        "";
      if (!currentUrl.includes("/sw.js")) {
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

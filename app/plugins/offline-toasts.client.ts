// app/plugins/offline-toasts.client.ts
import { watch } from "vue";

export default defineNuxtPlugin(() => {
  if (typeof window === "undefined") return;

  // Use the composable as the single SW message hub
  const sw = useServiceWorkerBridge();
  sw.startListening();

  // Push-notification deep-link: when the SW reports a notification URL, route to
  // it. (Previously lived in the old header layout; moved here so it survives the
  // mobile shell. Module 07: push deep-links into review.)
  const pendingUrls = new Set<string>();
  watch(sw.notificationUrl, (url) => {
    if (!url || pendingUrls.has(url)) return;
    pendingUrls.add(url);
    setTimeout(async () => {
      try {
        let targetUrl = url;
        try {
          const u = new URL(url, window.location.origin);
          if (u.origin === window.location.origin) {
            targetUrl = u.pathname + u.search + u.hash;
          }
        } catch {
          /* ignore parse */
        }
        await navigateTo(targetUrl);
      } finally {
        setTimeout(() => pendingUrls.delete(url), 1500);
      }
    }, 50);
  });
});

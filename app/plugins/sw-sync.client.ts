// app/plugins/sw-sync.client.ts
import {
  getServiceWorkerReadyRegistration,
  isServiceWorkerRuntimeEnabled,
} from "~/utils/serviceWorkerRuntime";

// Important: Do NOT block Nuxt mount. Never await a SW that may never be ready in dev.
export default defineNuxtPlugin(() => {
  if (import.meta.server) return;
  if (!isServiceWorkerRuntimeEnabled()) return;
  (async () => {
    try {
      const reg = await getServiceWorkerReadyRegistration(1500);

      if (!reg) return;

      // One-off Background Sync: let the SW run syncs when online
      // Note: FORM sync is registered here because it's always available
      // Note: NOTES sync is registered on-demand in useNotesStore when there are pending changes
      if ("sync" in reg) {
        try {
          // @ts-expect-error Background Sync is not in some TS lib DOM versions
          await reg.sync.register(SYNC_TAGS.FORM);
        } catch {
          // not supported / permission denied — ignore silently
        }
      }

      // Periodic Sync if available
      if ("periodicSync" in reg) {
        try {
          // @ts-expect-error periodicSync types are not guaranteed
          const tags = await reg.periodicSync.getTags?.();
          if (!tags?.includes(SYNC_TAGS.CONTENT)) {
            // @ts-expect-error periodicSync types are not guaranteed
            await reg.periodicSync.register(SYNC_TAGS.CONTENT, {
              minInterval: PERIODIC_SYNC_CONFIG.CONTENT_SYNC_INTERVAL,
            });
          }
        } catch {
          // not supported — ignore
        }
      }
    } catch {
      // ignore errors – best effort
    }
  })();
});

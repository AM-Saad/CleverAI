import { SYNC_TAGS } from "~/utils/constants/pwa";
import { getServiceWorkerReadyRegistration } from "~/utils/serviceWorkerRuntime";

/** Register the Notes-specific outbox for no-client/background recovery. */
export async function registerNotesBackgroundSync(): Promise<void> {
  if (!import.meta.client) return;
  try {
    const registration = await getServiceWorkerReadyRegistration(1500);
    if (registration && "sync" in registration) {
      // @ts-expect-error SyncManager is absent from some DOM type libraries.
      await registration.sync.register(SYNC_TAGS.NOTES);
    }
  } catch {
    // The window.online listener remains the required fallback.
  }
}

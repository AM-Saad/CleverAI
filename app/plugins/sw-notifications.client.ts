/**
 * Consolidated Service Worker notification handler
 * Combines functionality from sw-messages.client.ts and sw-idb-toasts.client.ts
 *
 * Handles all SW → Window message toasts:
 * - Storage errors (IDB init failures, backing store errors)
 * - Update available notifications
 * - Notes sync events (STARTED/SYNCED/ERROR/CONFLICTS)
 * - Storage restriction warnings
 */

export default defineNuxtPlugin(() => {
  if (!("serviceWorker" in navigator)) return;

  const toast = useToast();
  const router = useRouter();

  // Track which messages we've shown to avoid spam
  const shownMessages = new Set<string>();

  // Listen to Service Worker messages
  navigator.serviceWorker.addEventListener("message", (event: MessageEvent) => {
    const message = event.data;

    if (!message || typeof message !== "object") return;

    const { type, data } = message;

    // Debug: Log all SW messages
    console.log("📨 [sw-notifications] Received SW message:", { type, data });

    // ===== IDB/Storage Errors =====

    // IDB initialization failure (was in both old plugins!)
    if (type === "error" && data?.identifier === "idb-init-failed") {
      if (shownMessages.has(data.identifier)) return;
      shownMessages.add(data.identifier);

      toast.add({
        title: "Offline storage unavailable",
        description:
          data.message ||
          "Your browser blocked IndexedDB. Offline queue is disabled.",
        color: "error",
      });
      return;
    }

    // Storage backing store error (was in sw-messages.client.ts)
    if (
      type === "warning" &&
      data?.identifier === "storage-backing-store-error"
    ) {
      if (shownMessages.has(data.identifier)) return;
      shownMessages.add(data.identifier);

      toast.add({
        title: "Storage Issue Detected",
        description: data.message || "Browser storage is having issues.",
        color: "warning",
        actions: data.action
          ? [
              {
                label: "Fix Now",
                onClick: () => {
                  router.push(data.action);
                },
              },
            ]
          : undefined,
      });
      return;
    }

    // Generic error (was in sw-messages.client.ts)
    if (type === "error" && !data?.identifier) {
      toast.add({
        title: "Error",
        description: data?.message || "An error occurred.",
        color: "error",
      });
      return;
    }

    // ===== SW Update Notifications =====

    if (type === "update-available") {
      toast.add({
        title: "Update Available",
        description: "A new version is available. Refresh to update.",
        color: "info",
        actions: [
          {
            label: "Refresh",
            onClick: () => {
              window.location.reload();
            },
          },
        ],
      });
      return;
    }

    // ===== Notes Sync Events (was in sw-idb-toasts.client.ts) =====

    if (type === "NOTES_SYNC_STARTED") {
      const pendingCount = data?.pendingCount;
      toast.add({
        title: "Syncing notes…",
        description: pendingCount
          ? `${pendingCount} pending change(s).`
          : "Pending changes are being sent now.",
      });
      return;
    }

    if (type === "NOTES_SYNCED") {
      console.log("📥 [sw-notifications] Received NOTES_SYNCED:", {
        type,
        data,
      });
      const applied = data?.appliedCount ?? data?.applied ?? 0;
      const conflicts = data?.conflictsCount ?? 0;
      const descParts: string[] = [];

      descParts.push(applied ? `${applied} applied` : "No changes applied");
      if (conflicts) {
        descParts.push(`${conflicts} conflict(s)`);
      } else {
        descParts.push("No conflicts");
      }

      console.log("📥 [sw-notifications] Toast content:", {
        applied,
        conflicts,
        descParts,
      });
      toast.add({
        title: "Notes sync complete",
        description: descParts.join(" • "),
      });
      return;
    }

    if (type === "NOTES_SYNC_ERROR") {
      toast.add({
        title: "Notes sync failed",
        description: data?.message || "Will retry when back online.",
        color: "warning",
      });
      return;
    }

    if (type === "NOTES_SYNC_CONFLICTS") {
      const conflicts = data?.conflictsCount ?? 0;
      toast.add({
        title: "Notes conflicts",
        description: conflicts
          ? `${conflicts} note(s) need review.`
          : "Conflicts detected.",
        color: "warning",
      });
      return;
    }
  });

  // Listen for storage restriction events (was in sw-idb-toasts.client.ts)
  window.addEventListener("storage-restricted", (e: Event) => {
    const detail = (e as CustomEvent).detail || {};
    toast.add({
      title: "Limited offline capabilities",
      description: detail.reason
        ? String(detail.reason)
        : "Local storage is restricted; offline persistence reduced.",
      color: "warning",
    });
  });
});

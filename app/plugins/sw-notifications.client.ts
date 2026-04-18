/**
 * Consolidated Service Worker → window message handler.
 *
 * UX contract:
 *  - Sync STARTED messages are intentionally silent (background noise).
 *  - Sync SYNCED toasts only fire when there were actual changes (appliedCount > 0).
 *  - Sync ERROR and CONFLICTS toasts always fire so the user knows something needs attention.
 *  - Storage / IDB error toasts are deduplicated by identifier.
 *  - Board items sync events are handled identically to notes sync events.
 */

import { SW_MESSAGE_TYPES } from "~/utils/constants/pwa";

export default defineNuxtPlugin(() => {
  if (!("serviceWorker" in navigator)) return;

  const toast = useToast();
  const router = useRouter();

  // Track which one-time messages we've shown to avoid spam across re-registers.
  const shownMessages = new Set<string>();

  navigator.serviceWorker.addEventListener("message", (event: MessageEvent) => {
    const message = event.data;
    if (!message || typeof message !== "object") return;

    const { type, data } = message as { type: string; data?: Record<string, unknown> };

    // ── IDB / Storage Errors ──────────────────────────────────────────────────

    if (type === SW_MESSAGE_TYPES.ERROR && data?.identifier === "idb-init-failed") {
      if (shownMessages.has("idb-init-failed")) return;
      shownMessages.add("idb-init-failed");
      toast.add({
        title: "Offline storage unavailable",
        description: String(data.message ?? "Your browser blocked IndexedDB. Offline queue is disabled."),
        color: "error",
      });
      return;
    }

    if (type === "warning" && data?.identifier === "storage-backing-store-error") {
      if (shownMessages.has("storage-backing-store-error")) return;
      shownMessages.add("storage-backing-store-error");
      toast.add({
        title: "Storage Issue Detected",
        description: String(data.message ?? "Browser storage is having issues."),
        color: "warning",
        actions: data.action
          ? [{ label: "Fix Now", onClick: () => router.push(String(data.action)) }]
          : undefined,
      });
      return;
    }

    if (type === SW_MESSAGE_TYPES.ERROR && !data?.identifier) {
      toast.add({
        title: "Error",
        description: String(data?.message ?? "An error occurred."),
        color: "error",
      });
      return;
    }

    // ── SW Update ─────────────────────────────────────────────────────────────

    if (type === SW_MESSAGE_TYPES.SW_UPDATE_AVAILABLE || type === "update-available") {
      if (shownMessages.has("update-available")) return;
      shownMessages.add("update-available");
      toast.add({
        title: "Update Available",
        description: "A new version is available. Refresh to update.",
        color: "info",
        actions: [{ label: "Refresh", onClick: () => window.location.reload() }],
      });
      return;
    }

    // ── Notes Sync ────────────────────────────────────────────────────────────
    // STARTED is intentionally silent – background sync startup is noise not signal.

    if (type === SW_MESSAGE_TYPES.NOTES_SYNCED) {
      const applied = Number(data?.appliedCount ?? 0);
      const conflicts = Number(data?.conflictsCount ?? 0);
      // Only surface a toast when something actually changed.
      if (applied === 0 && conflicts === 0) return;
      const parts: string[] = [];
      if (applied) parts.push(`${applied} note${applied !== 1 ? "s" : ""} saved`);
      if (conflicts) parts.push(`${conflicts} conflict${conflicts !== 1 ? "s" : ""} need review`);
      toast.add({
        title: "Notes synced",
        description: parts.join(" · "),
        color: conflicts ? "warning" : "success",
      });
      return;
    }

    if (type === SW_MESSAGE_TYPES.NOTES_SYNC_ERROR) {
      toast.add({
        title: "Notes sync failed",
        description: String(data?.message ?? "Will retry when back online."),
        color: "warning",
      });
      return;
    }

    if (type === SW_MESSAGE_TYPES.NOTES_SYNC_CONFLICTS) {
      const conflicts = Number(data?.conflictsCount ?? 0);
      toast.add({
        title: "Notes conflicts",
        description: conflicts ? `${conflicts} note${conflicts !== 1 ? "s" : ""} need review.` : "Conflicts detected.",
        color: "warning",
      });
      return;
    }

    // ── Board Items Sync ──────────────────────────────────────────────────────
    // Same policy as notes: STARTED is silent, SYNCED only toasts on actual changes.

    if (type === SW_MESSAGE_TYPES.BOARD_ITEMS_SYNCED) {
      const applied = Number(data?.appliedCount ?? 0);
      if (applied === 0) return;
      toast.add({
        title: "Board synced",
        description: `${applied} item${applied !== 1 ? "s" : ""} saved`,
        color: "success",
      });
      return;
    }

    if (type === SW_MESSAGE_TYPES.BOARD_ITEMS_SYNC_ERROR) {
      toast.add({
        title: "Board sync failed",
        description: String(data?.message ?? "Will retry when back online."),
        color: "warning",
      });
      return;
    }

    // ── Navigation Events from SW ─────────────────────────────────────────────

    if (type === SW_MESSAGE_TYPES.NOTIFICATION_CLICK_NAVIGATE) {
      const url = String(data?.url ?? (message as { url?: string }).url ?? "");
      if (url) router.push(url);
      return;
    }
  });

  // Storage restriction custom event (dispatched by IDB helpers when quota is blocked)
  window.addEventListener("storage-restricted", (e: Event) => {
    const detail = (e as CustomEvent<{ reason?: string }>).detail ?? {};
    toast.add({
      title: "Limited offline capabilities",
      description: detail.reason ?? "Local storage is restricted; offline persistence reduced.",
      color: "warning",
    });
  });
});

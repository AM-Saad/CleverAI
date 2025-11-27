// app/plugins/offline-toasts.client.ts
import { watch } from "vue";

export default defineNuxtPlugin(() => {
  if (typeof window === "undefined") return;
  const toast = useToast?.() as ReturnType<typeof useToast> | undefined;

  // Keep immediate feedback for saving (DOM event from useOffline)
  const onSaved = (e: Event) => {
    const d = (e as CustomEvent).detail as
      | { id?: string; email?: string }
      | undefined;
    console.log("[Offline]", "Form queued locally", d);
    toast?.add({
      title: "Saved for offline",
      description: d?.email
        ? `We’ll send your login for ${d.email} when you’re online.`
        : "Your form was queued.",
    });
  };
  window.addEventListener(DOM_EVENTS.OFFLINE_FORM_SAVED, onSaved);

  // Use the composable as the single SW message hub
  const sw = useServiceWorkerBridge();
  sw.startListening();

  watch(sw.lastFormSyncEventType, (t) => {
    if (!t) return;
  const status = sw.formSyncStatus.value || undefined;
  const data = (sw.lastFormSyncData?.value ?? {}) as { appliedCount?: number };
    if (t === "FORM_SYNC_STARTED") {
      console.log("[Offline]", "Form sync started", status, data);
      toast?.add({
        title: "Syncing…",
        description: status || "Sending queued form now.",
      });
    } else if (t === "FORM_SYNCED") {
      console.log("[Offline]", "Form sync complete", status, data);
      const count = data.appliedCount;
      toast?.add({
        title: "Sent!",
        description:
          count != null
            ? `${count} record${count === 1 ? "" : "s"} delivered.`
            : status || "Your queued form was delivered.",
        type: "background",
      });
    } else if (t === "FORM_SYNC_ERROR") {
      console.warn("[Offline]", "Form sync failed", status, data);
      toast?.add({
        title: "Sync failed",
        description: status || "We’ll retry when you’re back online.",
        type: "background",
      });
    }
  });
});

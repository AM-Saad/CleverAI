// app/composables/useOffline.ts

/**
 * Minimal offline form queueing for login (or other small forms).
 * - Writes records into IndexedDB: DB 'recwide_db', store 'forms' (keyPath: 'id')
 * - Schedules a one-off Background Sync ('syncForm'); the SW will read & POST them
 * - NOTE: Do NOT store raw passwords. We only keep the email and a marker.
 */

type QueuedForm = {
  id: string;
  type: FormSyncType;
  payload: Record<string, unknown>;
  createdAt: number;
};

async function putForm(record: QueuedForm, storeName: STORES): Promise<void> {
  const db = await openUnifiedDB(); // consolidated: use unified opener
  // Do NOT close the DB; unified DB instance is shared. Closing causes InvalidStateError on other in-flight transactions.
  await putRecord(db, storeName, record);
}

export function useOffline() {
  const handleOfflineSubmit = async (data: {
    payload: Record<string, unknown>;
    storeName: STORES;
    type: FormSyncType;
    formId?: string;
  }): Promise<void> => {
    // Capacity guard: enforce MAX_PENDING_FORMS from config if available
    try {
      const db = await openUnifiedDB();
      if (db.objectStoreNames.contains(DB_CONFIG.STORES.FORMS)) {
        const tx = db.transaction([DB_CONFIG.STORES.FORMS], "readonly");
        const countReq = tx.objectStore(DB_CONFIG.STORES.FORMS).count();
        const currentCount: number = await new Promise((resolve, reject) => {
          countReq.onsuccess = () => resolve(countReq.result as number);
          // Fallback to 0 on error (do not block submission)
          countReq.onerror = () => resolve(0);
        });
        const MAX = OFFLINE_FORM_CONFIG?.MAX_PENDING_FORMS ?? 50;
        if (currentCount >= MAX) {
          try {
            const toast = typeof useToast === "function" ? useToast() : null;
            toast?.add({
              title: "Offline queue is full",
              description: `Maximum of ${MAX} pending items reached. Please reconnect to sync before adding more.`,
              color: "warning",
            });
          } catch {}
          return; // refuse new queue items
        }
      }
    } catch {
      // If IDB is unavailable, continue to attempt queuing (putForm will handle errors)
    }
    // 1) Queue a sanitized record locally
    const id =
      (data.formId || globalThis.crypto?.randomUUID?.()) ??
      `${Date.now()}-${Math.random().toString(16).slice(2)}`;

    await putForm(
      {
        id,
        type: data.type,
        payload: data.payload,
        createdAt: Date.now(),
      },
      data.storeName
    );

    // Emit a UI event so the app can show immediate feedback
    try {
      window.dispatchEvent(
        new CustomEvent(DOM_EVENTS.OFFLINE_FORM_SAVED, {
          detail: { id, payload: data.payload },
        })
      );
    } catch {
      // window may be undefined in some SSR contexts; ignore
    }

    // 2) Ask the active SW to run background sync when online
    try {
      const reg = await navigator.serviceWorker.ready;
      // This tag is what the SW listens for in its 'sync' event
      // We cannot pass payload here; the SW reads from IndexedDB instead.
      // @ts-expect-error - older TS libdefs don't know about SyncManager in some targets
      await reg.sync?.register?.(SYNC_TAGS.FORM);
    } catch {
      // Not supported or denied; no-op.
    }

    console.log("Form data queued locally and Background Sync requested.");
  };

  return { handleOfflineSubmit };
}

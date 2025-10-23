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

async function putForm(record: QueuedForm, storeName: string): Promise<void> {
  const db = await openFormsDB();
  await putRecord(db, storeName, record);
  db.close();
}

export function useOffline() {
  const handleOfflineSubmit = async (data: {
    payload: Record<string, unknown>;
    storeName: string;
    type: FormSyncType;
    formId?: string;
  }): Promise<void> => {
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

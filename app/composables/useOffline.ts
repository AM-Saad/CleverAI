export function useOffline(): {
  handleOfflineSubmit: (credentials: {
    email: string
    password: string
  }) => Promise<void>
} {
  const handleOfflineSubmit = async (credentials: {
    email: string
    password: string
  }): Promise<void> => {
    // Register a sync event
    const registration = await navigator.serviceWorker.ready
    await registration.sync.register("syncForm", {
      email: credentials.email,
      password: credentials.password,
    })

    if ("indexedDB" in window) {
      const db: IDBDatabase = await indexedDB.open("recwide_db", 1, {
        upgrade(db) {
          db.createObjectStore("forms")
        },
      })

      db.onsuccess = function (event: Event): void {
        const target = event.target as IDBOpenDBRequest

        const tx = target.result.transaction("forms", "readwrite")
        const store = tx.objectStore("forms")
        store.put({
          email: credentials.email,
          password: credentials.password,
        })

        tx.oncomplete = function (): void {
          console.log("Form data saved locally.")
        }

        tx.onerror = function (): void {
          console.log("Form data not saved locally.")
        }

        console.log("Form data saved locally and sync event registered.")
      }

      console.log("Form data saved locally and sync event registered.")
    }
    console.log("Form data saved locally and sync event registered.")
  }

  return {
    handleOfflineSubmit,
  }
}

// public/service-worker/index.ts
/// <reference lib="WebWorker" />
/// <reference types="vite/client" />

// Import types for better type safety
interface NotificationData {
  url?: string
  timestamp?: number
  [key: string]: unknown
}

console.log('🔄 Service Worker Loading...');
console.log('🔄 SW Script URL:', self.location.href);

console.log('🔄 SW Registration Time:', new Date().toISOString());
// Update test timestamp: 2025-08-23 01:35:00 - Testing update banner

import {
  cleanupOutdatedCaches,
  createHandlerBoundToURL,
  precacheAndRoute,
} from "workbox-precaching"
import { clientsClaim } from "workbox-core"
import { NavigationRoute, registerRoute } from "workbox-routing"
import { CacheFirst, NetworkFirst } from "workbox-strategies"
import { ExpirationPlugin } from "workbox-expiration"
import { calculate_chunk_size } from "../../app/utils/calculate_chunk_size"
import { SW_MESSAGE_TYPE } from "../../app/utils/constants/sw.enum"

declare let self: ServiceWorkerGlobalScope
let db: IDBDatabase

// Use workbox clientsClaim to handle clients immediately
clientsClaim()

// Precache manual entries only. The main `sw.js` contains the Workbox injection point.
precacheAndRoute([
  { url: "/about", revision: null }, // Cache the /about page
  { url: "/offline", revision: null }, // Cache the /offline page
])

// clean old assets
// cleanupOutdatedCaches()

let allowlist: undefined | RegExp[]
// allowlist = [/^\//]

// to allow work offline
registerRoute(
  new NavigationRoute(createHandlerBoundToURL("/"), {
    allowlist,
    //  denylist: [/^\/api/],
  }),
)

// Comprehensive Runtime Caching - All the patterns that make offline work!

// 1. Images - Basic image files
registerRoute(
  ({ request }) => new RegExp(/\.(?:png|gif|jpg|jpeg|webp|svg|ico)$/).test(request.url),
  new CacheFirst({
    cacheName: "images",
    plugins: [
      new ExpirationPlugin({
        maxEntries: 44,
        maxAgeSeconds: 7 * 24 * 60 * 60, // 7 Days
      }),
    ],
  }),
)

// 2. JavaScript files
registerRoute(
  ({ request }) => new RegExp(/\.(?:js|mjs|ts)$/).test(request.url),
  new CacheFirst({
    cacheName: "javascript",
    plugins: [
      new ExpirationPlugin({
        maxEntries: 60,
        maxAgeSeconds: 7 * 24 * 60 * 60,
      }),
    ],
  }),
)

// 3. CSS files
registerRoute(
  ({ request }) => new RegExp(/\.(?:css)$/).test(request.url),
  new CacheFirst({
    cacheName: "stylesheets",
    plugins: [
      new ExpirationPlugin({
        maxEntries: 20,
        maxAgeSeconds: 7 * 24 * 60 * 60,
      }),
    ],
  }),
)

// 4. Vite Development Tools - NetworkFirst for HMR
registerRoute(
  ({ url }) => new RegExp(/^\/_nuxt\/@vite\//).test(url.pathname),
  new NetworkFirst({
    cacheName: "vite-dev",
    plugins: [
      new ExpirationPlugin({
        maxEntries: 10,
        maxAgeSeconds: 60 * 60, // 1 hour
      }),
    ],
    networkTimeoutSeconds: 3,
  }),
)

// 5. Nuxt Filesystem routes
registerRoute(
  ({ url }) => new RegExp(/^\/_nuxt\/@fs\//).test(url.pathname),
  new CacheFirst({
    cacheName: "nuxt-fs",
    plugins: [
      new ExpirationPlugin({
        maxEntries: 30,
        maxAgeSeconds: 7 * 24 * 60 * 60,
      }),
    ],
  }),
)

// 6. Nuxt Virtual modules
registerRoute(
  ({ url }) => new RegExp(/^\/_nuxt\/@id\//).test(url.pathname),
  new CacheFirst({
    cacheName: "nuxt-virtual",
    plugins: [
      new ExpirationPlugin({
        maxEntries: 50,
        maxAgeSeconds: 3 * 24 * 60 * 60, // 3 days
      }),
    ],
  }),
)

// 7. PWA Plugin assets
registerRoute(
  ({ url }) => new RegExp(/^\/_nuxt\/@vite-plugin-pwa\//).test(url.pathname),
  new CacheFirst({
    cacheName: "pwa-assets",
    plugins: [
      new ExpirationPlugin({
        maxEntries: 10,
        maxAgeSeconds: 7 * 24 * 60 * 60,
      }),
    ],
  }),
)

// 8. Vite client modules
registerRoute(
  ({ url }) => new RegExp(/\/_nuxt\/.*@vite\/client.*/).test(url.pathname),
  new CacheFirst({
    cacheName: "vite-client",
    plugins: [
      new ExpirationPlugin({
        maxEntries: 10,
        maxAgeSeconds: 24 * 60 * 60, // 1 day
      }),
    ],
  }),
)

// 9. Virtual modules
registerRoute(
  ({ url }) => new RegExp(/\/_nuxt\/.*virtual.*/).test(url.pathname),
  new CacheFirst({
    cacheName: "virtual-modules",
    plugins: [
      new ExpirationPlugin({
        maxEntries: 20,
        maxAgeSeconds: 24 * 60 * 60, // 1 day
      }),
    ],
  }),
)

// 10. Critical: Vue Plugin Export Helper - This was breaking offline!
registerRoute(
  ({ request }) => new RegExp(/__x00__plugin-vue:export-helper/).test(request.url),
  new CacheFirst({
    cacheName: "vite-plugin-vue",
    plugins: [
      new ExpirationPlugin({
        maxEntries: 10,
        maxAgeSeconds: 24 * 60 * 60, // 1 day
      }),
    ],
  }),
)

// 11. All Vite virtual plugins
registerRoute(
  ({ request }) => new RegExp(/__x00__.*/).test(request.url),
  new CacheFirst({
    cacheName: "vite-plugins",
    plugins: [
      new ExpirationPlugin({
        maxEntries: 20,
        maxAgeSeconds: 24 * 60 * 60, // 1 day
      }),
    ],
  }),
)

// 12. Vue page components
registerRoute(
  ({ url }) => new RegExp(/\/_nuxt\/pages\/.*\.vue(\?.*)?$/).test(url.pathname),
  new CacheFirst({
    cacheName: "vue-pages",
    plugins: [
      new ExpirationPlugin({
        maxEntries: 50,
        maxAgeSeconds: 7 * 24 * 60 * 60, // 1 week
      }),
    ],
  }),
)

// 13. Vue macro pages
registerRoute(
  ({ request }) => new RegExp(/.*\.vue\?macro=true$/).test(request.url),
  new CacheFirst({
    cacheName: "vue-macro-pages",
    plugins: [
      new ExpirationPlugin({
        maxEntries: 100,
        maxAgeSeconds: 7 * 24 * 60 * 60, // 1 week
      }),
    ],
  }),
)

// 14. Vue components from filesystem
registerRoute(
  ({ url }) => new RegExp(/\/_nuxt\/@fs\/.*\.vue$/).test(url.pathname),
  new CacheFirst({
    cacheName: "node-modules-vue",
    plugins: [
      new ExpirationPlugin({
        maxEntries: 100,
        maxAgeSeconds: 7 * 24 * 60 * 60, // 1 week
      }),
    ],
  }),
)

// 15. Build metadata
registerRoute(
  ({ url }) => new RegExp(/\/_nuxt\/builds\/meta\/.*\.json$/).test(url.pathname),
  new CacheFirst({
    cacheName: "nuxt-build-meta",
    plugins: [
      new ExpirationPlugin({
        maxEntries: 10,
        maxAgeSeconds: 24 * 60 * 60, // 1 day
      }),
    ],
  }),
)

// 16. Image imports with query parameters
registerRoute(
  ({ request }) => new RegExp(/.*\.(png|jpg|jpeg|gif|svg|webp)\?import$/).test(request.url),
  new CacheFirst({
    cacheName: "image-imports",
    plugins: [
      new ExpirationPlugin({
        maxEntries: 100,
        maxAgeSeconds: 7 * 24 * 60 * 60, // 1 week
      }),
    ],
  }),
)

// 17. API Session - NetworkFirst for fresh auth
registerRoute(
  ({ url }) => new RegExp(/\/api\/session$/).test(url.pathname),
  new NetworkFirst({
    cacheName: "api-session",
    plugins: [
      new ExpirationPlugin({
        maxEntries: 5,
        maxAgeSeconds: 5 * 60, // 5 minutes
      }),
    ],
    networkTimeoutSeconds: 3,
  }),
)

// 18. Vue components
registerRoute(
  ({ url }) => new RegExp(/\/_nuxt\/.*\.vue$/).test(url.pathname),
  new CacheFirst({
    cacheName: "vue-components",
    plugins: [
      new ExpirationPlugin({
        maxEntries: 200,
        maxAgeSeconds: 7 * 24 * 60 * 60, // 1 week
      }),
    ],
  }),
)

// 19. Static images from assets
registerRoute(
  ({ url }) => new RegExp(/\/_nuxt\/assets\/images\/.*\.(png|jpg|jpeg|gif|svg|webp)$/).test(url.pathname),
  new CacheFirst({
    cacheName: "static-images",
    plugins: [
      new ExpirationPlugin({
        maxEntries: 100,
        maxAgeSeconds: 30 * 24 * 60 * 60, // 30 days
      }),
    ],
  }),
)

// 20. Node modules
registerRoute(
  ({ url }) => new RegExp(/\/_nuxt\/.*\/node_modules\/.*$/).test(url.pathname),
  new CacheFirst({
    cacheName: "node-modules",
    plugins: [
      new ExpirationPlugin({
        maxEntries: 100,
        maxAgeSeconds: 7 * 24 * 60 * 60, // 1 week
      }),
    ],
  }),
)

// 21. Favicon
registerRoute(
  ({ url }) => new RegExp(/\/favicon\.ico$/).test(url.pathname),
  new CacheFirst({
    cacheName: "favicon",
    plugins: [
      new ExpirationPlugin({
        maxEntries: 5,
        maxAgeSeconds: 30 * 24 * 60 * 60, // 30 days
      }),
    ],
  }),
)

// 22. Screenshots
registerRoute(
  ({ url }) => new RegExp(/\/screenshots\/.*\.(png|jpg|jpeg|gif|svg|webp)$/).test(url.pathname),
  new CacheFirst({
    cacheName: "screenshots",
    plugins: [
      new ExpirationPlugin({
        maxEntries: 20,
        maxAgeSeconds: 30 * 24 * 60 * 60, // 30 days
      }),
    ],
  }),
)

// 23. External HTML pages
registerRoute(
  ({ request }) => new RegExp(/^https?:.*\.(html)$/).test(request.url),
  new NetworkFirst({
    cacheName: "pages",
    plugins: [
      new ExpirationPlugin({
        maxEntries: 10,
        maxAgeSeconds: 24 * 60 * 60, // 1 day
      }),
    ],
  }),
)

// 24. General _nuxt catch-all (AFTER specific patterns)
registerRoute(
  ({ url }) => url.pathname.startsWith("/_nuxt/"),
  new CacheFirst({
    cacheName: "nuxt-catch-all",
    plugins: [
      new ExpirationPlugin({
        maxEntries: 500,
        maxAgeSeconds: 7 * 24 * 60 * 60, // 1 week
      }),
    ],
  }),
)

// 25. Ultimate catch-all for offline fallback (MUST be last!)
registerRoute(
  ({ request }) => true, // Matches everything
  new CacheFirst({
    cacheName: "offline-fallback",
    plugins: [
      new ExpirationPlugin({
        maxEntries: 1000,
        maxAgeSeconds: 7 * 24 * 60 * 60, // 1 week
      }),
    ],
  }),
)

// Open Database
function openDatabase() {
  return new Promise((resolve, reject) => {
    const request: IDBOpenDBRequest = indexedDB.open("recwide_db", 1)

    request.onupgradeneeded = function (event: IDBVersionChangeEvent) {
      if (!event.target) return
      const target = event.target as IDBOpenDBRequest
      db = target.result
      const objectStore = db.createObjectStore("projects", {
        keyPath: "name",
        autoIncrement: true,
      })
      objectStore.createIndex("name", "name", { unique: false })

      const objectStore2 = db.createObjectStore("forms", {
        keyPath: "email",
        autoIncrement: true,
      })
      objectStore2.createIndex("email", "email", { unique: false })
    }

    request.onsuccess = function (event: Event) {
      const target = event.target as IDBOpenDBRequest
      db = target.result
      resolve(db)
    }

    request.onerror = function (event: Event) {
      const target = event.target
      reject("Database error: " + target)
    }
  })
}

openDatabase()
  .then((db) => {
    console.assert("Database opened successfully")
  })
  .catch((error) => {
    console.error(error)
  })

// Events listeners
console.log('🔄 SW: Adding push event listener...');
self.addEventListener("push", async (event: PushEvent) => {
  console.log("🔔 SW: Push event received!");
  console.log("🔔 SW: Event data exists:", !!event.data);
  console.log("🔔 SW: Full event object:", event);

  event.waitUntil(
    (async () => {
      try {
        if (!event.data) {
          console.warn('🔔 SW: Push event has no data');
          return;
        }

        const data = event.data.json();
        console.log("Push event received data -> ", data)

        // Validate required fields
        if (!data.title && !data.message) {
          console.error('Invalid push notification data - missing title and message');
          return;
        }

        const options: NotificationOptions = {
          body: data.message || '',
          icon: data.icon || '/icons/192x192.png',
          badge: '/icons/96x96.png',
          tag: data.tag || 'default',
          requireInteraction: data.requireInteraction || false,
          silent: data.silent || false,
          data: {
            url: data.url || '/',
            timestamp: Date.now(),
            ...data.data
          },
        };

        console.log('About to show notification with options:', options);
        console.log('Notification title:', data.title || 'Notification');

        // Show the notification
        await self.registration.showNotification(
          data.title || 'Notification',
          options
        );

        console.log('✅ Notification shown successfully!');

      } catch (error) {
        console.error('❌ Error in push event handler:', error);

        // Show a fallback notification if possible
        try {
          await self.registration.showNotification(
            'CleverAI Notification',
            {
              body: 'You have a new notification',
              icon: '/icons/192x192.png',
              tag: 'fallback'
            }
          );
        } catch (fallbackError) {
          console.error('❌ Failed to show fallback notification:', fallbackError);
        }
      }
    })()
  );
})

self.addEventListener("notificationclick", (event: NotificationEvent) => {
  console.log("🔔 Notification clicked", event.notification)
  event.notification.close()

  event.waitUntil(
    (async () => {
      try {
        // Get the URL to navigate to
        const notificationData = event.notification.data || {}
        const targetUrl = notificationData.url || '/'
        console.log("🔔 Target URL:", targetUrl)

        // Always try to use message passing first for better reliability
        const clients = await self.clients.matchAll({
          type: 'window',
          includeUncontrolled: true
        })

        console.log("🔔 Found clients:", clients.length)

        if (clients.length > 0) {
          // Use message passing to navigate - most reliable method
          for (const client of clients) {
            console.log("🔔 Sending navigation message to client")
            client.postMessage({
              type: 'NOTIFICATION_CLICK_NAVIGATE',
              url: targetUrl
            })
          }

          // Try to focus the first client
          try {
            await clients[0].focus()
            console.log("🔔 Client focused successfully")
          } catch (focusError) {
            console.log("🔔 Focus failed (this is normal):", focusError.message)
          }

          return // Exit here as we've handled the navigation via message
        }

        // Only try to open new window if no clients exist
        console.log("🔔 No existing clients, attempting to open new window")
        try {
          const newClient = await self.clients.openWindow(targetUrl)
          if (newClient) {
            console.log("🔔 New window opened successfully")
          } else {
            console.log("🔔 Failed to open new window (blocked or failed)")
          }
        } catch (openError) {
          console.log("🔔 Cannot open new window:", openError.message)
          console.log("🔔 This is expected when not user-activated or service worker not controlling")
        }

      } catch (error) {
        console.error('🔔 Error handling notification click:', error)
      }
    })()
  )
})

self.addEventListener("periodicsync", (event: any) => {
  console.log("Something happening in periodicsync..")
  if (event.tag === "content-sync") {
    event.waitUntil(syncContent())
  }
})

self.addEventListener("sync", async (event: any) => {
  console.log("Something happening in sync..")

  if (event.tag === "syncForm") {
    const clients = await self.clients.matchAll()
    clients.forEach((client) => {
      client.postMessage({
        type: SW_MESSAGE_TYPE.SYNC_FORM,
        data: { message: "Syncing data..", data: event.data },
      })
    })
    return syncAuthentcation(clients)
  }
})

// Combined message handler for client communication
self.addEventListener('message', async (event) => {
  console.log('SW: Received message:', event.data);
  const { type, files, uploadUrl, name } = event.data || {};

  // Handle service worker lifecycle messages
  if (event.data && event.data.type === 'SKIP_WAITING') {
    console.log('SW: Skipping waiting...');
    self.skipWaiting();
    return;
  }

  if (event.data && event.data.type === 'CLAIM_CONTROL') {
    console.log('SW: Claiming control...');
    try {
      await self.clients.claim();
      console.log('SW: Successfully claimed control');

      // Notify all clients that control has been claimed
      const clients = await self.clients.matchAll();
      clients.forEach(client => {
        client.postMessage({
          type: 'SW_CONTROL_CLAIMED',
          message: 'Service worker now controlling this page'
        });
      });
    } catch (error) {
      console.error('SW: Error claiming control:', error);
    }
    return;
  }

  // Handle test notification click message
  if (type === "TEST_NOTIFICATION_CLICK") {
    console.log("🔔 SW: Test notification click received");
    const targetUrl = event.data.data?.url || '/';

    try {
      const clients = await self.clients.matchAll({
        type: 'window',
        includeUncontrolled: true
      });

      if (clients.length > 0) {
        const client = clients[0];
        client.postMessage({
          type: 'NOTIFICATION_CLICK_NAVIGATE',
          url: targetUrl
        });
        console.log("🔔 SW: Posted navigation message to client");
      } else {
        console.log("🔔 SW: No clients found, opening new window");
        await self.clients.openWindow(targetUrl);
      }
    } catch (error) {
      console.error("🔔 SW: Error in test notification click:", error);
    }
    return;
  }

  // Handle file upload messages
  if (type == "uploadFiles") {
    // Notify the originating client about the upload start (if needed)
    if (event.source && 'id' in event.source && event.source.id) {
      const client = await self.clients.get(event.source.id)
      if (!client) {
        console.error("Client not found")
        return
      }
      client.postMessage({
        type: SW_MESSAGE_TYPE.UPLOAD_START,
        data: { message: "Upload has started." },
      })
    }
    handleDatabaseOperation({ action: "add", payload: { name, files } })
    await handleConcurrentUploads(name, files, uploadUrl)
  }
});

function handleDatabaseOperation(data: { action: string; payload: any }) {
  // Start a new transaction
  const transaction = db.transaction(["projects"], "readwrite")
  console.info(`Transaction Started With Action = ${data.action}`)

  // Get the object store
  const objectStore = transaction.objectStore("projects")
  console.info(`Object Store = ${objectStore.name}`)

  // Perform the desired operation (add, get, update, delete)
  let request

  if (data.action === "add") {
    console.log("Data to be added: ", data.payload)
    // Ensure payload contains the `name` property for the in-line key
    request = objectStore.add(data.payload)
  } else if (data.action === "get") {
    request = objectStore.get(data.payload.id)
  } else if (data.action === "update") {
    request = objectStore.put(data.payload)
  } else if (data.action === "delete") {
    request = objectStore.delete(data.payload.id)
  }

  request!.onsuccess = function (event) {
    console.log("Transaction Operation successful", event.target)
  }

  request!.onerror = function (event) {
    console.error("Transaction Operation error: ", event.target)
  }
}

// Functions
async function syncContent() {
  // Your logic to update or fetch content in the background
  console.log("Syncing content...")
  // Implement your content sync logic here
}

async function syncAuthentcation(clients: readonly Client[]) {
  const formData = getLocalData()
  if (formData) {
    const response = await sendDataToServer(formData)
    if (!response.ok) {
      console.error("Failed to sync form data with the server.")
      clients.forEach((client) => {
        client.postMessage({
          type: SW_MESSAGE_TYPE.FORM_SYNC_ERROR,
          data: { message: "Failed to sync form data with the server." },
        })
      })
      return
    }

    clients.forEach((client) => {
      client.postMessage({
        type: SW_MESSAGE_TYPE.FORM_SYNCED,
        data: { message: "Form data synced with the server." },
      })
    })
    console.log("Form data synced with the server.")
    // Optionally remove the local data after successful sync
    removeLocalData()
  }
}

const getLocalData = () => {
  // Retrieve the local data form the indexedDB to be synced
  // Return the data to be sent to the server

  const transaction = db.transaction(["forms"], "readwrite")
  const objectStore = transaction.objectStore("forms")
  const request = objectStore.getAll()

  request.onsuccess = function (event) {
    const target = event.target as IDBRequest
    console.log("Data retrieved successfully", target?.result)
    return target.result
  }

  request.onerror = function (event) {
    const target = event.target as IDBRequest
    console.error("Error retrieving data", target?.error)
    return null
  }

  return null
}

const sendDataToServer = async (data: any) => {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 20000) // Set timeout to 20 seconds
  console.info("Sending data to server")

  const formData = new FormData()
  formData.append("data", data)

  try {
    const response = await fetch(`${process.env.AUTH_ORIGIN}/auth/`, {
      method: "POST",
      body: formData,
      signal: controller.signal,
    })
    clearTimeout(timeoutId) // Clear the timeout if the request completes in time
    if (!response.ok) throw new Error("Upload failed")
    // Optionally parse and return response data here
    return response
  } catch (error) {
    console.log(error)
    clearTimeout(timeoutId) // Ensure to clear the timeout if an error occurs
    throw error
  }
}

const removeLocalData = () => {
  // Remove the local data after successful sync
}

async function uploadChunk(data: {
  chunk: any
  index: any
  totalChunks: any
  fileIdentifier: any
  uploadUrl: any
}) {
  const { chunk, index, totalChunks, fileIdentifier, uploadUrl } = data
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 20000) // Set timeout to 20 seconds
  console.info("Upload chunk index ", index)

  const formData = new FormData()
  formData.append("file", chunk)
  formData.append("index", index)
  formData.append("totalChunks", totalChunks)
  formData.append("identifier", fileIdentifier)

  try {
    const response = await fetch(uploadUrl, {
      method: "POST",
      body: formData,
      signal: controller.signal,
    })
    clearTimeout(timeoutId) // Clear the timeout if the request completes in time
    if (!response.ok) throw new Error("Upload failed")
    // Optionally parse and return response data here
  } catch (error) {
    console.log(error)
    clearTimeout(timeoutId) // Ensure to clear the timeout if an error occurs
    throw error
  }
}

async function uploadFile(file: any, uploadUrl: any, retryDelays: any) {
  const chunkSize = calculate_chunk_size(file.size)
  console.info("Chunk size", chunkSize)

  const totalChunks = Math.ceil(file.size / chunkSize)
  console.info("Total chunks", totalChunks)

  const fileIdentifier = `${file.name}-${Date.now()}` // Example unique identifier

  const uploadPromises: Promise<void>[] = []

  for (let index = 0; index < totalChunks; index++) {
    const chunk = file.slice(index * chunkSize, (index + 1) * chunkSize)

    uploadPromises.push(
      (async () => {
        for (let attempt = 0; attempt < retryDelays.length; attempt++) {
          try {
            const data = {
              chunk,
              index,
              totalChunks,
              fileIdentifier,
              uploadUrl,
            }
            await uploadChunk(data)

            const clients = await self.clients.matchAll()
            clients.forEach((client) => {
              client.postMessage({
                type: SW_MESSAGE_TYPE.PROGRESS,
                data: { identifier: fileIdentifier, index, totalChunks },
              })
            })
            break // Success, exit retry loop
          } catch (error) {
            if (attempt < retryDelays.length - 1) {
              // If not the last attempt, wait for the retry delay before retrying
              await new Promise((resolve) =>
                setTimeout(resolve, retryDelays[attempt]),
              )
            } else {
              // Last attempt, throw error without waiting
              throw error
            }
          }
        }
      })(),
    )
  }

  try {
    const res = await Promise.all(uploadPromises)
    console.log("Upload complete", file.name, res)
    self.clients.matchAll().then((clients) => {
      clients.forEach((client) => {
        client.postMessage({
          type: SW_MESSAGE_TYPE.FILE_COMPLETE,
          data: {
            identifier: fileIdentifier,
            message: `${file.name} upload complete`,
          },
        })
      })
    })
  } catch (error) {
    console.error("Failed to upload", file.name, error)
    self.clients.matchAll().then((clients) => {
      clients.forEach((client) => {
        client.postMessage({
          type: "error",
          data: {
            message: `Failed to upload ${file.name}`,
            identifier: fileIdentifier,
          },
        })
      })
    })
  }
}

async function handleConcurrentUploads(
  name: string,
  files: File[],
  uploadUrl: string,
) {
  const retryDelays = [5000, 10000, 15000] // Milliseconds to wait before retries
  const maxConcurrentUploads = 4 // Adjust based on your server capacity
  const concurrentUploads: Promise<void>[] = []

  for (const file of files) {
    if (concurrentUploads.length >= maxConcurrentUploads) {
      await Promise.race(concurrentUploads)
    }

    const uploadPromise = uploadFile(file, uploadUrl, retryDelays)
    concurrentUploads.push(uploadPromise)

    // Remove settled promises from the array
    uploadPromise.finally(() => {
      const index = concurrentUploads.indexOf(uploadPromise)
      if (index !== -1) {
        concurrentUploads.splice(index, 1)
      }
    })
  }

  await Promise.all(concurrentUploads) // Ensure all uploads complete
  // Broadcast to all clients that all files are uploaded
  self.clients.matchAll().then((clients) => {
    clients.forEach((client) => {
      client.postMessage({
        type: SW_MESSAGE_TYPE.ALL_FILES_COMPLETE,
        data: { message: "All uploads complete." },
      })
    })
  })
}




// Service Worker Lifecycle Events
console.log('🔄 SW: Adding lifecycle event listeners...');

self.addEventListener('install', (event) => {
  console.log('🔄 SW: Install event triggered');
  console.log('🔄 SW: skipWaiting()...');
  // Skip waiting to activate immediately
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (event) => {
  console.log('🔄 SW: Activate event triggered');
  console.log('🔄 SW: Cleaning up caches and claiming control...');

  event.waitUntil(
    Promise.resolve(cleanupOutdatedCaches()).then(async () => {
      console.log('🔄 SW: Cache cleanup complete');

      // Claim control of all clients immediately
      await self.clients.claim();
      console.log('🔄 SW: Service worker claimed control');

      console.log('🔄 SW: Service worker activated and ready');

      // Notify all clients that the service worker is controlling
      const clients = await self.clients.matchAll({ includeUncontrolled: true });
      if (clients.length > 0) {
        console.log('� SW: Notifying clients of activation');
        clients.forEach(client => {
          client.postMessage({
            type: 'SW_ACTIVATED',
            message: 'Service worker is now active and controlling the page'
          });
        });
      }
    })
  );
});

// Lifecycle message handlers are already included in the main message handler above

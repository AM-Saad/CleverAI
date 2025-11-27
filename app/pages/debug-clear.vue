<template>
  <div class="min-h-screen p-8">
    <UCard>
      <template #header>
        <h1 class="text-2xl font-bold">Clear All Storage & Cache</h1>
      </template>

      <div class="space-y-4">
        <UAlert
          v-if="status"
          :color="status.type"
          :title="status.message"
        />

        <div class="space-y-2">
          <p class="text-sm text-gray-600">
            This will clear:
          </p>
          <ul class="list-disc list-inside text-sm text-gray-600 space-y-1">
            <li>All IndexedDB databases (including Workbox metadata)</li>
            <li>All Cache Storage (Workbox precache & runtime caches)</li>
            <li>Service Worker registration</li>
            <li>Local Storage</li>
          </ul>

          <p class="text-sm text-red-600 font-semibold mt-4">
            ⚠️ Warning: This will clear all offline data and require re-syncing.
          </p>
        </div>

        <div class="flex gap-2">
          <UButton
            color="error"
            :loading="clearing"
            @click="clearAll"
          >
            Clear Everything
          </UButton>

          <UButton
            color="warning"
            variant="outline"
            :loading="clearing"
            @click="clearWorkboxOnly"
          >
            Clear Workbox Only
          </UButton>
        </div>

        <div v-if="details.length > 0" class="mt-4">
          <p class="text-sm font-semibold mb-2">Details:</p>
          <ul class="text-xs text-gray-600 space-y-1">
            <li v-for="(detail, idx) in details" :key="idx">
              {{ detail }}
            </li>
          </ul>
        </div>

        <!-- Browser-level fix instructions -->
        <UCard v-if="status?.type === 'warning' || status?.type === 'error'" class="mt-6 bg-orange-50 dark:bg-orange-950/20">
          <template #header>
            <h3 class="text-lg font-semibold text-orange-700 dark:text-orange-400">
              🔧 Browser-Level Fix Required
            </h3>
          </template>

          <div class="space-y-3 text-sm">
            <p class="font-semibold">
              IndexedDB is corrupted at the browser level. Use one of these methods:
            </p>

            <div class="space-y-4">
              <div class="border-l-4 border-blue-500 pl-3">
                <p class="font-semibold text-blue-700 dark:text-blue-400">Method 1: Chrome DevTools (Recommended)</p>
                <ol class="list-decimal list-inside space-y-1 mt-2 text-gray-700 dark:text-gray-300">
                  <li>Open DevTools (F12 or Cmd+Option+I)</li>
                  <li>Go to <strong>Application</strong> tab</li>
                  <li>Under <strong>Storage</strong>, click <strong>"Clear site data"</strong></li>
                  <li>Check all boxes and click <strong>"Clear site data"</strong></li>
                  <li>Close ALL tabs of this site</li>
                  <li>Restart your browser</li>
                </ol>
              </div>

              <div class="border-l-4 border-purple-500 pl-3">
                <p class="font-semibold text-purple-700 dark:text-purple-400">Method 2: Browser Settings</p>
                <ol class="list-decimal list-inside space-y-1 mt-2 text-gray-700 dark:text-gray-300">
                  <li>Go to <strong>Browser Settings</strong> → <strong>Privacy & Security</strong></li>
                  <li>Click <strong>"Clear browsing data"</strong></li>
                  <li>Select <strong>"All time"</strong> range</li>
                  <li>Check: Cookies, Cached images, Site data</li>
                  <li>Click <strong>"Clear data"</strong></li>
                  <li>Restart your browser</li>
                </ol>
              </div>

              <div class="border-l-4 border-red-500 pl-3">
                <p class="font-semibold text-red-700 dark:text-red-400">Method 3: Fresh Profile (Nuclear)</p>
                <ol class="list-decimal list-inside space-y-1 mt-2 text-gray-700 dark:text-gray-300">
                  <li>Create a new browser profile</li>
                  <li>Or use a different browser (Firefox, Safari, Edge)</li>
                  <li>Or use <strong>Incognito/Private mode</strong> temporarily</li>
                </ol>
              </div>
            </div>

            <UAlert
              color="warning"
              variant="soft"
              title="Why is this happening?"
              description="IndexedDB corruption usually occurs due to: browser crashes, disk errors, antivirus interference, or browser bugs. It's not caused by the application."
            />
          </div>
        </UCard>
      </div>
    </UCard>
  </div>
</template>

<script setup lang="ts">
const clearing = ref(false)
const status = ref<{ type: 'success' | 'error' | 'warning', message: string } | null>(null)
const details = ref<string[]>([])
const idbBroken = ref(false)

// Check if IndexedDB is working at all
onMounted(async () => {
  try {
    await indexedDB.databases?.()
  } catch {
    idbBroken.value = true
    status.value = {
      type: 'error',
      message: 'IndexedDB is completely broken. Use the browser-level fix below.'
    }
  }
})

async function clearWorkboxOnly() {
  clearing.value = true
  status.value = null
  details.value = []

  try {
    let dbErrors = 0

    // Try to clear Workbox-related IndexedDB databases
    try {
      const dbs = await indexedDB.databases?.() || []
      
      for (const dbInfo of dbs) {
        if (dbInfo.name?.includes('workbox') || dbInfo.name?.startsWith('wb-')) {
          try {
            await new Promise<void>((resolve, reject) => {
              const req = indexedDB.deleteDatabase(dbInfo.name!)
              req.onsuccess = () => {
                details.value.push(`✓ Deleted Workbox DB: ${dbInfo.name}`)
                resolve()
              }
              req.onerror = () => reject(req.error)
              req.onblocked = () => {
                details.value.push(`⚠ Blocked: ${dbInfo.name} (close all tabs)`)
                resolve()
              }
            })
          } catch (dbErr) {
            dbErrors++
            details.value.push(`✗ Failed to delete ${dbInfo.name}: ${dbErr}`)
          }
        }
      }
    } catch (idbErr: any) {
      dbErrors++
      details.value.push(`⚠ IndexedDB unavailable: ${idbErr.message}`)
    }

    // Clear Workbox caches (this usually works even if IDB is broken)
    const cacheNames = await caches.keys()
    for (const cacheName of cacheNames) {
      if (cacheName.includes('workbox')) {
        await caches.delete(cacheName)
        details.value.push(`✓ Deleted cache: ${cacheName}`)
      }
    }

    // Unregister service worker (this is critical)
    const registrations = await navigator.serviceWorker?.getRegistrations() || []
    for (const reg of registrations) {
      await reg.unregister()
      details.value.push(`✓ Unregistered SW: ${reg.scope}`)
    }

    if (dbErrors > 0) {
      status.value = { 
        type: 'warning', 
        message: `Partial cleanup: ${dbErrors} database(s) couldn't be deleted. Try the browser-level fix below.` 
      }
    } else {
      status.value = { type: 'success', message: 'Workbox storage cleared! Refresh the page.' }
    }
  } catch (e: any) {
    status.value = { type: 'error', message: `Error: ${e.message}` }
    console.error('Clear error:', e)
  } finally {
    clearing.value = false
  }
}

async function clearAll() {
  clearing.value = true
  status.value = null
  details.value = []

  try {
    let dbErrors = 0

    // 1. Try to clear ALL IndexedDB databases
    try {
      const dbs = await indexedDB.databases?.() || []
      
      for (const dbInfo of dbs) {
        if (dbInfo.name) {
          try {
            await new Promise<void>((resolve, reject) => {
              const req = indexedDB.deleteDatabase(dbInfo.name!)
              req.onsuccess = () => {
                details.value.push(`✓ Deleted DB: ${dbInfo.name}`)
                resolve()
              }
              req.onerror = () => reject(req.error)
              req.onblocked = () => {
                details.value.push(`⚠ Blocked: ${dbInfo.name} (close all tabs)`)
                resolve()
              }
            })
          } catch (dbErr) {
            dbErrors++
            details.value.push(`✗ Failed to delete ${dbInfo.name}: ${dbErr}`)
          }
        }
      }
    } catch (idbErr: any) {
      dbErrors++
      details.value.push(`⚠ IndexedDB unavailable: ${idbErr.message}`)
    }

    // 2. Clear ALL caches
    const cacheNames = await caches.keys()
    for (const cacheName of cacheNames) {
      await caches.delete(cacheName)
      details.value.push(`✓ Deleted cache: ${cacheName}`)
    }

    // 3. Unregister service workers
    const registrations = await navigator.serviceWorker?.getRegistrations() || []
    for (const reg of registrations) {
      await reg.unregister()
      details.value.push(`✓ Unregistered SW: ${reg.scope}`)
    }

    // 4. Clear localStorage
    localStorage.clear()
    details.value.push(`✓ Cleared localStorage`)

    // 5. Clear sessionStorage
    sessionStorage.clear()
    details.value.push(`✓ Cleared sessionStorage`)

    if (dbErrors > 0) {
      status.value = { 
        type: 'warning', 
        message: `Partial cleanup completed. ${dbErrors} database(s) couldn't be deleted due to corruption. See browser-level fix below.` 
      }
    } else {
      status.value = { type: 'success', message: 'All storage cleared! Refresh the page.' }
    }
  } catch (e: any) {
    status.value = { type: 'error', message: `Error: ${e.message}` }
    console.error('Clear error:', e)
  } finally {
    clearing.value = false
  }
}
</script>

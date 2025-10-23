<!-- app/pages/offline.vue -->

<template>
  <div
    data-testid="offline-page"
    class="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center p-4"
  >
    <div class="text-center max-w-md">
      <!-- Network Status Icon -->
      <div class="mb-8 flex justify-center">
        <div class="relative">
          <div
            class="w-24 h-24 bg-gray-700 rounded-full flex items-center justify-center border-4 border-gray-600"
          >
            <svg
              class="w-12 h-12 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M18.364 5.636l-12.728 12.728m0-12.728l12.728 12.728M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z"
              />
            </svg>
          </div>
          <!-- Pulsing offline indicator -->
          <div
            class="absolute -top-2 -right-2 w-6 h-6 bg-red-500 rounded-full animate-pulse border-2 border-white"
          />
        </div>
      </div>

      <!-- Main Message -->
      <h1 class="text-4xl font-bold text-white mb-4">You're Offline</h1>
      <p class="text-gray-300 text-lg mb-8">
        It looks like you've lost your internet connection. Don't worry - some
        content might still be available.
      </p>

      <!-- Action Buttons -->
      <div class="space-y-4">
        <!-- Retry Connection -->
        <button
          class="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 text-white font-semibold py-3 px-6 rounded-lg transition-colors flex items-center justify-center"
          :disabled="isChecking"
          @click="checkConnection"
        >
          <svg
            v-if="isChecking"
            class="animate-spin -ml-1 mr-3 h-5 w-5 text-white"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              class="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              stroke-width="4"
            />
            <path
              class="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
          {{ isChecking ? "Checking..." : "Try Again" }}
        </button>

        <!-- Go to Home -->
        <button
          class="w-full bg-gray-700 hover:bg-gray-600 text-white font-semibold py-3 px-6 rounded-lg transition-colors"
          @click="goHome"
        >
          Go to Homepage
        </button>

        <!-- View Cached Content -->
        <button
          class="w-full bg-purple-700 hover:bg-purple-600 text-white font-semibold py-3 px-6 rounded-lg transition-colors"
          @click="showCachedContent = !showCachedContent"
        >
          {{ showCachedContent ? "Hide" : "View" }} Available Content
        </button>
      </div>

      <!-- Cached Content Section -->
      <div v-if="showCachedContent" class="mt-8 p-4 bg-gray-800/50 rounded-lg">
        <h3 class="text-lg font-semibold text-white mb-3">Available Offline</h3>
        <div class="space-y-2">
          <NuxtLink
            v-for="page in availablePages"
            :key="page.path"
            :to="page.path"
            class="block text-blue-400 hover:text-blue-300 transition-colors text-left"
          >
            {{ page.title }}
          </NuxtLink>
        </div>
        <p v-if="availablePages.length === 0" class="text-gray-400 text-sm">
          No cached pages available. Content will be cached as you browse.
        </p>
      </div>

      <!-- Network Status -->
      <div class="mt-8 p-4 bg-red-900/30 border border-red-700 rounded-lg">
        <div class="flex items-center justify-center space-x-2">
          <div class="w-3 h-3 bg-red-500 rounded-full animate-pulse" />
          <span class="text-red-200 text-sm">Network unavailable</span>
        </div>
        <p class="text-red-300 text-xs mt-2">
          Last checked: {{ lastChecked || "Never" }}
        </p>
      </div>
    </div>
  </div>
</template>

<script setup>

definePageMeta({
  auth: false,
});

const router = useRouter();
const isChecking = ref(false);
const showCachedContent = ref(false);
const lastChecked = ref(null);

// Use centralized available pages
const availablePages = ref([...OFFLINE_PAGES]);

const checkConnection = async () => {
  isChecking.value = true;
  lastChecked.value = new Date().toLocaleTimeString();

  try {
    // Wait a bit to show the checking state
    await new Promise((resolve) =>
      setTimeout(resolve, NETWORK_CONFIG.CHECK_DELAY),
    );

    // Try to fetch a small resource to check connectivity
    const response = await fetch("/favicon.ico", {
      cache: "no-cache",
      signal: AbortSignal.timeout(NETWORK_CONFIG.CHECK_TIMEOUT),
    });

    if (response.ok) {
      // Connection restored, redirect to home
      await router.push("/");
    } else {
      throw new Error("No connection");
    }
  } catch (error) {
    console.log("Still offline:", error);
    // Still offline, show message
    setTimeout(() => {
      // You could show a toast notification here
    }, 500);
  } finally {
    isChecking.value = false;
  }
};

const goHome = () => {
  router.push("/");
};

// Auto-check connection when page becomes visible
onMounted(() => {
  // Listen for visibility changes to auto-retry when user returns
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden && navigator.onLine) {
      checkConnection();
    }
  });

  // Listen for online events
  window.addEventListener("online", () => {
    router.push("/");
  });
});
</script>

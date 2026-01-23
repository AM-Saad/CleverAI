<template>
  <div class="mx-auto  flex h-screen flex-col gap-y-3 justify-between">
    <nav id="nav"
      class="flex basis-0 shrink-0 font-heading items-center justify-between py-4 md:rounded-none  mx-auto left-[50%] top-4 border-b border-neutral dark:border-muted w-[calc(100%-2rem)]">
      <div class="flex items-center justify-between w-full">
        <div class="flex items-center gap-2">

          <router-link to="/" class="flex items-center gap-2 text-dark dark:text-light font-medium text-xl ">
            <img class="h-7 dark:invert-[1] dark:filter" :src="'/images/CleverAI_icon.svg'" alt="" />
            Cognilo</router-link>
          <div class=" flex items-center justify-center" :title="online ? 'You are online' : 'You are offline'"
            v-if="route.fullPath.startsWith('/folders') || route.fullPath.startsWith('/user')">
            <span v-if="online" class="bg-green-300 rounded-full border border-muted w-3 h-3 animate-pulse"
              title="Online"></span>
            <span v-if="!online" class="bg-gray-300 rounded-full border border-muted w-3 h-3" title="Offline"></span>
          </div>
        </div>


        <div v-if="status === 'authenticated'" class="flex gap-5">
          <ui-dropdown-menu />
        </div>
        <div v-else-if="status === 'unauthenticated'" class="flex gap-5">
          <router-link to="/about">
            <u-button variant="ghost">About</u-button>
          </router-link>
          <router-link to="/auth/signIn">
            <u-button variant="subtle">Login</u-button>
          </router-link>
          <router-link to="/auth/signup">
            <u-button>Signup</u-button>
          </router-link>
        </div>
        <div v-else>
          <span>Loading...</span>
        </div>


      </div>
    </nav>

    <div class=" mx-auto h-full w-full flex-1 flex flex-col px-4 overflow-hidden" style=" flex: 1 1 auto;">
      <!-- <UToaster /> -->
      <ServiceWorkerUpdateNotification mode="banner" />
      <SharedAIModalStatus />
      <slot />
    </div>
    <footer class="xl:container mx-auto rounded-sm  h-10 dark:bg-transparent" style="flex: 0 0 auto;">
      <div class="footer-wrapper grid">
        <div class="footer-social">
          <ul>
            <li>
              <a><i class="fab fa-facebook-f" /></a>
            </li>
            <li>
              <a><i class="fab fa-twitter" /></a>
            </li>
            <li>
              <a><i class="fab fa-instagram" /></a>
            </li>
            <li>
              <a><i class="fab fa-google" /></a>
            </li>
          </ul>
        </div>
      </div>
      <p class="my-2 text-center text-sm dark:text-gray-300">
        Provided by <a class="underline" href="https://amsaad.cc">Abdelrahman Saad</a>
      </p>
    </footer>
  </div>
</template>
<!-- eslint-disable no-console -->

<script setup lang="ts">

import { watch } from "vue";
// import cleverAIIcon from "~/assets/images/CleverAI_icon.svg";

console.log("🏗️ [LAYOUT] Default layout script setup initializing...");

const { status } = useAuth();
console.log("🏗️ [LAYOUT] Auth status:", status.value);

// Use the centralized SW bridge
const sw = useServiceWorkerBridge();
const online = useOnline()

const route = useRoute();
console.log("🏗️ [LAYOUT] Current route:", route.fullPath.startsWith('/folders'), route.fullPath.startsWith('/user'));
// Debounced navigation to avoid rapid duplicates from notification clicks
const pending = new Set<string>();

// Ensure listeners are wired once and react to navigation messages
onMounted(() => {
  sw.startListening();
  watch(sw.notificationUrl, (url) => {
    if (url && !pending.has(url)) {
      pending.add(url);
      // Small delay helps ensure SW activation/state is settled
      setTimeout(async () => {
        try {
          // Normalize to internal path if same-origin full URL
          let targetUrl = url;
          try {
            const u = new URL(url, window.location.origin);
            if (u.origin === window.location.origin) {
              targetUrl = u.pathname + u.search + u.hash;
            }
          } catch {
            /* ignore parse */
          }
          console.log("🔔 Client: Navigating to:", targetUrl);
          await navigateTo(targetUrl);
        } finally {
          setTimeout(() => pending.delete(url), 1500);
        }
      }, 50);
    }
  });

  watch(sw.lastFormSyncEventType, (t) => {
    if (!t) return;
    console.log("🏗️ [LAYOUT] Form sync event:", t, sw.formSyncStatus.value);
  });
});

console.log("🏗️ [LAYOUT] Default layout script setup completed");
</script>

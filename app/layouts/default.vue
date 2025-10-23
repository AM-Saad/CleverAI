<template>
  <div
    class="mx-auto max-w-full flex h-screen flex-col gap-y-4 justify-between"
  >
    <nav
      id="nav"
      class="flex font-heading items-center justify-between z-50 py-2 px-1 rounded-full md:rounded container mx-auto left-[50%] top-4 border-b border-muted w-[calc(100%-1rem)]"
    >
      <div class="flex items-center justify-between w-full">
        <router-link
          to="/"
          class="flex items-center gap-4 text-dark dark:text-light font-medium md:text-xl"
        >
          <img
            class="h-6 dark:invert-[1] dark:filter"
            src="~/assets/images/CleverAI_icon.svg"
            alt=""
          />
          ShaterAI
        </router-link>
        <div v-if="status === 'authenticated'" class="flex gap-5">
          <ui-dropdown-menu />
        </div>
        <div v-else-if="status === 'unauthenticated'" class="flex gap-5">
          <router-link to="/auth/signIn">
            <UButton size="sm" variant="subtle"> Login </UButton>
          </router-link>
          <router-link to="/auth/signup">
            <UButton size="sm"> Signup </UButton>
          </router-link>
        </div>
        <div v-else>
          <span>Loading...</span>
        </div>
        <svg
          data-v-7c76a2b5=""
          class="hidden"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs data-v-7c76a2b5="">
            <filter
              id="filter"
              data-v-7c76a2b5=""
              color-interpolation-filters="sRGB"
            >
              <feImage
                data-v-7c76a2b5=""
                x="0"
                y="0"
                width="100%"
                height="100%"
                href="data:image/svg+xml,%0A%20%20%20%20%3Csvg%20viewBox%3D%220%200%20672%2060%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%0A%20%20%20%20%20%20%3Cdefs%3E%0A%20%20%20%20%20%20%20%20%3ClinearGradient%20id%3D%22red%22%20x1%3D%22100%25%22%20y1%3D%220%25%22%20x2%3D%220%25%22%20y2%3D%220%25%22%3E%0A%20%20%20%20%20%20%20%20%20%20%3Cstop%20offset%3D%220%25%22%20stop-color%3D%22%230000%22%2F%3E%0A%20%20%20%20%20%20%20%20%20%20%3Cstop%20offset%3D%22100%25%22%20stop-color%3D%22red%22%2F%3E%0A%20%20%20%20%20%20%20%20%3C%2FlinearGradient%3E%0A%20%20%20%20%20%20%20%20%3ClinearGradient%20id%3D%22blue%22%20x1%3D%220%25%22%20y1%3D%220%25%22%20x2%3D%220%25%22%20y2%3D%22100%25%22%3E%0A%20%20%20%20%20%20%20%20%20%20%3Cstop%20offset%3D%220%25%22%20stop-color%3D%22%230000%22%2F%3E%0A%20%20%20%20%20%20%20%20%20%20%3Cstop%20offset%3D%22100%25%22%20stop-color%3D%22blue%22%2F%3E%0A%20%20%20%20%20%20%20%20%3C%2FlinearGradient%3E%0A%20%20%20%20%20%20%3C%2Fdefs%3E%0A%20%20%20%20%20%20%3Crect%20x%3D%220%22%20y%3D%220%22%20width%3D%22672%22%20height%3D%2260%22%20fill%3D%22black%22%3E%3C%2Frect%3E%0A%20%20%20%20%20%20%3Crect%20x%3D%220%22%20y%3D%220%22%20width%3D%22672%22%20height%3D%2260%22%20rx%3D%2216%22%20fill%3D%22url(%23red)%22%20%2F%3E%0A%20%20%20%20%20%20%3Crect%20x%3D%220%22%20y%3D%220%22%20width%3D%22672%22%20height%3D%2260%22%20rx%3D%2216%22%20fill%3D%22url(%23blue)%22%20style%3D%22mix-blend-mode%3A%20difference%22%20%2F%3E%0A%20%20%20%20%20%20%3Crect%20%0A%20%20%20%20%20%20%20%20x%3D%222.1%22%20%0A%20%20%20%20%20%20%20%20y%3D%222.1%22%20%0A%20%20%20%20%20%20%20%20width%3D%22667.8%22%20%0A%20%20%20%20%20%20%20%20height%3D%2255.8%22%20%0A%20%20%20%20%20%20%20%20rx%3D%2216%22%20%0A%20%20%20%20%20%20%20%20fill%3D%22hsl(0%200%25%2050%25%20%2F%200.93)%22%20%0A%20%20%20%20%20%20%20%20style%3D%22filter%3Ablur(11px)%22%20%0A%20%20%20%20%20%20%2F%3E%0A%20%20%20%20%3C%2Fsvg%3E%0A%20%20"
                result="map"
              />
              <feDisplacementMap
                id="redchannel"
                data-v-7c76a2b5=""
                in="SourceGraphic"
                in2="map"
                xChannelSelector="R"
                yChannelSelector="B"
                scale="-180"
                result="dispRed"
              />
              <feColorMatrix
                data-v-7c76a2b5=""
                in="dispRed"
                type="matrix"
                values="1 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 1 0"
                result="red"
              />
              <feDisplacementMap
                id="greenchannel"
                data-v-7c76a2b5=""
                in="SourceGraphic"
                in2="map"
                xChannelSelector="R"
                yChannelSelector="B"
                scale="-170"
                result="dispGreen"
              />
              <feColorMatrix
                data-v-7c76a2b5=""
                in="dispGreen"
                type="matrix"
                values="0 0 0 0 0 0 1 0 0 0 0 0 0 0 0 0 0 0 1 0"
                result="green"
              />
              <feDisplacementMap
                id="bluechannel"
                data-v-7c76a2b5=""
                in="SourceGraphic"
                in2="map"
                xChannelSelector="R"
                yChannelSelector="B"
                scale="-160"
                result="dispBlue"
              />
              <feColorMatrix
                data-v-7c76a2b5=""
                in="dispBlue"
                type="matrix"
                values="0 0 0 0 0 0 0 0 0 0 0 0 1 0 0 0 0 0 1 0"
                result="blue"
              />
              <feBlend
                data-v-7c76a2b5=""
                in="red"
                in2="green"
                mode="screen"
                result="rg"
              />
              <feBlend
                data-v-7c76a2b5=""
                in="rg"
                in2="blue"
                mode="screen"
                result="output"
              />
              <feGaussianBlur data-v-7c76a2b5="" stdDeviation="0.2" />
            </filter>
          </defs>
        </svg>
      </div>
    </nav>

    <div class="container mx-auto p-4 overflow-auto h-full w-full">
      <UToaster />
      <ServiceWorkerUpdateNotification mode="banner" />
      <slot />
    </div>
    <footer class="rounded-sm p-2">
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
          <ul class="flex justify-center gap-5">
            <li class="dark:text-gray-300">
              <a href="/">Support</a>
            </li>
            <li class="dark:text-gray-300">
              <router-link to="/about"> About </router-link>
            </li>
            <li class="dark:text-gray-300">
              <a href="/">Contact </a>
            </li>
          </ul>
        </div>
      </div>
      <p class="my-2 text-center text-sm dark:text-gray-300">
        Provided by
        <a class="underline" href="https://amsaad.cc">Abdelrahman Saad</a>
      </p>
    </footer>
  </div>
</template>
<!-- eslint-disable no-console -->

<script setup lang="ts">
import { watch } from "vue";

console.log("🏗️ [LAYOUT] Default layout script setup initializing...");

const { status } = useAuth();
console.log("🏗️ [LAYOUT] Auth status:", status.value);

// Use the centralized SW bridge
const sw = useServiceWorkerBridge();

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

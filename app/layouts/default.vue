<template>
  <div class="mx-auto  flex h-screen flex-col gap-y-3 justify-between">
    <nav id="nav"
      class="flex basis-0 shrink-0 font-heading items-center justify-between py-1.5 md:rounded-none  mx-auto left-[50%] top-4 border-b border-secondary  w-[calc(100%-2rem)] h-16">
      <div class="flex items-center justify-between w-full h-full">
        <div class="flex items-center gap-2 h-full">

          <router-link to="/" class="flex items-center text-content-on-surface font-medium text-xl h-full">
            <!-- <img class="h-6 dark:invert-[1] dark:filter" :src="'/images/CleverAI_icon.svg'" alt="" /> -->
            <svg xmlns="http://www.w3.org/2000/svg" width="70" height="30" viewBox="0 0 75 55" fill="none">
              <g id="CleverLogo">
                <path id="Holder"
                  d="M15.8359 9.34961H57.6641C62.7666 9.34984 66.9871 13.3228 67.2959 18.416L68.5078 38.416C68.8441 43.9648 64.4349 48.6502 58.876 48.6504H14.624C9.06508 48.6502 4.65592 43.9648 4.99219 38.416L6.2041 18.416C6.51289 13.3228 10.7334 9.34984 15.8359 9.34961Z"
                  fill="#F1F1F1" stroke="#333333" stroke-width="0.7" />
                <g id="Workspaces">
                  <path id="Workspace3"
                    d="M15.9053 6.34961H57.8867C63.1118 6.34975 67.3881 10.5093 67.5332 15.7324L68.0439 34.1211C68.1946 39.5532 63.8317 44.039 58.3975 44.0391H15.3945C9.96035 44.0388 5.59838 39.5532 5.74902 34.1211L6.25977 15.7324C6.40485 10.5094 10.6803 6.34986 15.9053 6.34961Z"
                    fill="white" stroke="#333333" stroke-width="0.7" />
                  <path id="Workspace2"
                    d="M15.8967 6.35608H52.9368C58.1824 6.35615 62.4672 10.5473 62.5842 15.7916L62.9944 34.1735C63.1151 39.5858 58.7606 44.0386 53.3469 44.0387H15.4866C10.0728 44.0387 5.71843 39.5859 5.83911 34.1735L6.24927 15.7916C6.36626 10.5472 10.651 6.35608 15.8967 6.35608Z"
                    fill="white" stroke="#333333" stroke-width="0.7" />
                  <path id="Workspace1"
                    d="M15.6985 6.35608H46.4915C51.7631 6.35613 56.0588 10.587 56.1399 15.858L56.4231 34.2399C56.506 39.6267 52.162 44.0384 46.7747 44.0387H15.4163C10.0286 44.0387 5.68397 39.6268 5.76685 34.2399L6.05005 15.858C6.13114 10.5871 10.427 6.35626 15.6985 6.35608Z"
                    fill="white" fill-opacity="0.1" stroke="#333333" stroke-width="0.7" />
                </g>
                <g id="Confirm">
                  <path id="circle"
                    d="M14 33.2998C15.4912 33.2998 16.7002 34.5088 16.7002 36C16.7002 37.4912 15.4912 38.7002 14 38.7002C12.5088 38.7002 11.2998 37.4912 11.2998 36C11.2998 34.5088 12.5088 33.2998 14 33.2998Z"
                    stroke="#333333" stroke-width="0.6" />
                  <path id="correct" d="M13 36.1546L13.5942 37L15 35" stroke="#333333" stroke-width="0.6"
                    stroke-linecap="round" stroke-linejoin="round" />
                </g>
              </g>
            </svg>
            Cognilo
          </router-link>
          <Transition name="fade">
            <span v-if="!online && (route.fullPath.startsWith('/workspaces') || route.fullPath.startsWith('/user'))"
              class="inline-flex items-center gap-1 rounded-full bg-warning/15 px-2.5 py-0.5 text-xs font-medium text-warning ring-1 ring-inset ring-warning/25"
              title="You are offline — changes are saved locally">
              <span class="h-1.5 w-1.5 rounded-full bg-warning" />
              Offline
            </span>
          </Transition>
        </div>


        <div v-if="status === 'authenticated'" class="flex gap-5 items-center">
          <NuxtLink to="/language">
            <u-button variant="ghost" size="sm" title="Language">
              <Icon name="i-lucide-languages" class="w-4 h-4" />
            </u-button>
          </NuxtLink>
          <SharedCreditsPill />
          <ui-dropdown-menu />
        </div>
        <div v-else-if="status === 'unauthenticated'" class="flex gap-5">
          <router-link to="/about">
            <u-button variant="ghost">About</u-button>
          </router-link>
          <router-link to="/auth/signIn">
            <u-button variant="ghost">Login</u-button>
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
      <language-quick-capture-button v-if="status === 'authenticated'" />
      <!-- Single global CreditsWallet — opened via creditsStore.openWallet() from anywhere in the app -->
      <shared-credits-wallet v-if="status === 'authenticated'" :is-open="creditsStore.isWalletOpen"
        @close="creditsStore.closeWallet()" />
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
      <p class="my-2 text-center text-sm dark:text-content-secondary">
        Provided by <a class="underline" href="https://amsaad.cc">Abdelrahman Saad</a>
      </p>
    </footer>
  </div>
</template>
<script setup lang="ts">

import { watch } from "vue";

const { status } = useAuth();

const creditsStore = useCreditsStore();

// Use the centralized SW bridge
const sw = useServiceWorkerBridge();
const online = useOnline()

const route = useRoute();
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
          await navigateTo(targetUrl);
        } finally {
          setTimeout(() => pending.delete(url), 1500);
        }
      }, 50);
    }
  });

  watch(sw.lastFormSyncEventType, (t) => {
    if (!t) return;
  });
});
</script>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>


<style scoped>
#Workspace1,
#Workspace2,
#Workspace3 {
  opacity: 0;
  animation: workspaceLoop 11s infinite;
}

#Workspace1 {
  animation-delay: 1s;
}

#Workspace2 {
  animation-delay: 0.6s;
}

#Workspace3 {
  animation-delay: 0.2s;
}

#Confirm {
  opacity: 0;
  animation: confirmLoop 11s infinite;
}

@keyframes workspaceLoop {
  0% {
    opacity: 0;
    transform: translateY(-20px);
  }

  /* 1. Drop & Stay Still (approx 0.5s - 5s) */
  5%,
  45% {
    opacity: 1;
    transform: translateY(0);
  }

  /* 2. Slide Right (at 5s mark) */
  50%,
  90% {
    opacity: 1;
    transform: translateX(100px);
  }

  /* 3. Disappear (at 10s mark) to prep for next drop */
  95%,
  100% {
    opacity: 0;
    transform: translateX(100px);
  }
}

@keyframes confirmLoop {

  /* 0% to 50%: Workspaces are dropping/sitting. Confirm is HIDDEN. */
  0%,
  50% {
    opacity: 0;
    visibility: hidden;
  }

  /* 55%: Fade in after workspaces have moved right. */
  55%,
  85% {
    opacity: 1;
    visibility: visible;
  }

  /* 90%: Fade out BEFORE the workspaces reset to the top. */
  90%,
  100% {
    opacity: 0;
    visibility: hidden;
  }
}
</style>
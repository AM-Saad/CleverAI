<template>
  <div class="mx-auto flex flex-col gap-y-3 justify-between"
    :class="isWorkspaceDetailRoute ? 'h-screen overflow-hidden' : 'min-h-screen'">
    <a
      href="#main-content"
      class="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[var(--z-tooltip)] focus:rounded-[var(--radius-md)] focus:bg-primary focus:px-3 focus:py-2 focus:text-sm focus:font-semibold focus:text-on-primary focus:shadow-[var(--shadow-dropdown)]"
    >
      Skip to main content
    </a>
    <nav id="nav"
      class="flex basis-0 shrink-0 font-heading items-center justify-between py-1.5 md:rounded-none mx-auto left-[50%] top-4 border-b border-secondary w-full max-w-full h-16 px-3 sm:px-4">
      <div class="flex items-center justify-between w-full h-full min-w-0 gap-2">
        <div class="flex items-center gap-2 h-full min-w-0">

          <router-link to="/" class="flex items-center text-content-on-surface font-medium text-xl h-full min-w-0">
            <!-- <img class="h-6 dark:invert-[1] dark:filter" :src="'/images/CleverAI_icon.svg'" alt="" /> -->
            <svg xmlns="http://www.w3.org/2000/svg" width="50" height="30" viewBox="0 0 75 55" fill="none">
              <g id="CleverLogo">
                <path id="Holder"
                  d="M15.8359 9.34961H57.6641C62.7666 9.34984 66.9871 13.3228 67.2959 18.416L68.5078 38.416C68.8441 43.9648 64.4349 48.6502 58.876 48.6504H14.624C9.06508 48.6502 4.65592 43.9648 4.99219 38.416L6.2041 18.416C6.51289 13.3228 10.7334 9.34984 15.8359 9.34961Z"
                  fill="var(--color-surface-subtle)" stroke="var(--color-content-on-background)" stroke-width="0.7" />
                <g id="Workspaces">
                  <path id="Workspace3"
                    d="M15.9053 6.34961H57.8867C63.1118 6.34975 67.3881 10.5093 67.5332 15.7324L68.0439 34.1211C68.1946 39.5532 63.8317 44.039 58.3975 44.0391H15.3945C9.96035 44.0388 5.59838 39.5532 5.74902 34.1211L6.25977 15.7324C6.40485 10.5094 10.6803 6.34986 15.9053 6.34961Z"
                    fill="var(--color-surface-subtle)" stroke="var(--color-content-on-background)" stroke-width="0.7" />
                  <path id="Workspace2"
                    d="M15.8967 6.35608H52.9368C58.1824 6.35615 62.4672 10.5473 62.5842 15.7916L62.9944 34.1735C63.1151 39.5858 58.7606 44.0386 53.3469 44.0387H15.4866C10.0728 44.0387 5.71843 39.5859 5.83911 34.1735L6.24927 15.7916C6.36626 10.5472 10.651 6.35608 15.8967 6.35608Z"
                    fill="var(--color-surface)" stroke="var(--color-content-on-background)" stroke-width="0.7" />
                  <path id="Workspace1"
                    d="M15.6985 6.35608H46.4915C51.7631 6.35613 56.0588 10.587 56.1399 15.858L56.4231 34.2399C56.506 39.6267 52.162 44.0384 46.7747 44.0387H15.4163C10.0286 44.0387 5.68397 39.6268 5.76685 34.2399L6.05005 15.858C6.13114 10.5871 10.427 6.35626 15.6985 6.35608Z"
                    fill="var(--color-surface-strong)" fill-opacity="0.1" stroke="var(--color-content-on-background)"
                    stroke-width="0.7" />
                </g>
                <g id="Confirm">
                  <path id="circle"
                    d="M14 33.2998C15.4912 33.2998 16.7002 34.5088 16.7002 36C16.7002 37.4912 15.4912 38.7002 14 38.7002C12.5088 38.7002 11.2998 37.4912 11.2998 36C11.2998 34.5088 12.5088 33.2998 14 33.2998Z"
                    stroke="var(--color-content-on-background)" stroke-width="0.6" />
                  <path id="correct" d="M13 36.1546L13.5942 37L15 35" stroke="var(--color-content-on-background)"
                    stroke-width="0.6" stroke-linecap="round" stroke-linejoin="round" />
                </g>
              </g>
            </svg>
            <span class="hidden sm:inline">Cognilo</span>
          </router-link>
          <Transition name="fade">
            <span v-if="networkPill && (route.fullPath.startsWith('/workspaces') || route.fullPath.startsWith('/user'))"
              class="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset"
              :class="networkPill.class" :title="networkPill.title">
              <span class="h-1.5 w-1.5 rounded-full" :class="networkPill.dotClass" />
              {{ networkPill.label }}
            </span>
          </Transition>
        </div>

        <div v-if="status === 'authenticated'" class="flex min-w-0 items-center justify-end gap-1 sm:gap-3">
          <ui-button
            variant="ghost"
            size="sm"
            title="Language"
            aria-label="Open language learning"
            to="/language"
          >
            <shared-icon name="translation" class="w-4 h-4" />
          </ui-button>
          <SharedCreditsPill />
          <UiColorModeToggle />
          <div ref="notificationMenuRef" class="relative">
            <ui-button
              variant="ghost"
              size="sm"
              square
              icon="i-heroicons-bell"
              aria-label="Open notifications"
              class="relative"
              @click="toggleNotifications"
            >
              <span
                v-if="unreadCount > 0"
                class="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-error px-1 text-[10px] font-semibold text-white"
              >
                {{ unreadCount > 9 ? "9+" : unreadCount }}
              </span>
            </ui-button>
            <SharedInAppNotificationsPanel
              v-if="showNotifications"
              :notifications="notifications"
              :unread-count="unreadCount"
              :loading="notificationsLoading"
              @close="showNotifications = false"
              @mark-all-read="handleMarkAllRead"
              @select="handleNotificationSelect"
            />
          </div>
          <ui-dropdown-menu />
        </div>
        <div v-else-if="status === 'unauthenticated'" class="flex gap-5 items-center">
          <UiColorModeToggle />
          <router-link to="/about">
            <ui-button variant="ghost">About</ui-button>
          </router-link>
          <router-link to="/auth/signIn">
            <ui-button variant="ghost">Login</ui-button>
          </router-link>
          <router-link to="/auth/signup">
            <ui-button>Signup</ui-button>
          </router-link>
        </div>
        <div v-else>
          <span>Loading...</span>
        </div>


      </div>
    </nav>

    <main id="main-content" tabindex="-1" class="mx-auto w-full flex-1 flex flex-col px-4 py-1.5 min-w-0 focus:outline-none"
      :class="isWorkspaceDetailRoute ? 'h-full overflow-hidden' : 'overflow-visible'" style=" flex: 1 1 auto;">
      <!-- <UToaster /> -->
      <ServiceWorkerUpdateNotification mode="banner" />
      <SharedAIModalStatus />
      <slot />
      <QuickCaptureButton v-if="showGlobalQuickCapture" />
      <!-- Single global CreditsWallet — opened via creditsStore.openWallet() from anywhere in the app -->
      <shared-credits-wallet v-if="status === 'authenticated'" :is-open="creditsStore.isWalletOpen"
        @close="creditsStore.closeWallet()" />
    </main>
    <footer v-if="!route.fullPath.startsWith('/workspaces') && !route.fullPath.startsWith('/user')"
      class="xl:container mx-auto rounded-[var(--radius-sm)]  h-10 dark:bg-transparent" style="flex: 0 0 auto;">
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

import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import QuickCaptureButton from "~/features/language-learning/components/QuickCaptureButton.vue";

const { status } = useAuth();
const {
  notifications,
  unreadCount,
  loading: notificationsLoading,
  refresh: refreshNotifications,
  markRead,
  markAllRead,
  reset: resetNotifications,
} = useInAppNotifications();
const showNotifications = ref(false);
const notificationMenuRef = ref<HTMLElement | null>(null);

const creditsStore = useCreditsStore();

// Use the centralized SW bridge
const sw = useServiceWorkerBridge();
const networkStatus = useNetworkStatus();

const route = useRoute();
const isWorkspaceDetailRoute = computed(() =>
  /^\/workspaces\/[^/]+/.test(route.path)
);
const showGlobalQuickCapture = computed(
  () => status.value === "authenticated" && !isWorkspaceDetailRoute.value,
);
const networkPill = computed(() => {
  if (!networkStatus.isOnline.value) {
    return {
      label: "Offline",
      title: "You are offline — changes are saved locally",
      class: "bg-warning/15 text-warning-text ring-warning/25",
      dotClass: "bg-warning",
    };
  }

  if (!networkStatus.isVerifiedOnline.value || networkStatus.isConnecting.value) {
    return {
      label: "Reconnecting",
      title: "Checking server reachability before syncing changes",
      class: "bg-primary/10 text-primary ring-primary/20",
      dotClass: "bg-primary animate-pulse",
    };
  }

  return null;
});
// Debounced navigation to avoid rapid duplicates from notification clicks
const pending = new Set<string>();

function toggleNotifications() {
  showNotifications.value = !showNotifications.value;
  if (showNotifications.value) {
    void refreshNotifications();
  }
}

async function handleNotificationSelect(notification: {
  id: string;
  url?: string | null;
  isRead: boolean;
}) {
  if (!notification.isRead) {
    await markRead(notification.id);
  }

  showNotifications.value = false;
  if (notification.url) {
    await navigateTo(notification.url);
  }
}

async function handleMarkAllRead() {
  await markAllRead();
}

function handleNotificationClickOutside(event: MouseEvent) {
  if (
    notificationMenuRef.value &&
    !notificationMenuRef.value.contains(event.target as Node)
  ) {
    showNotifications.value = false;
  }
}

// Ensure listeners are wired once and react to navigation messages
onMounted(() => {
  document.addEventListener("click", handleNotificationClickOutside);
  if (status.value === "authenticated") {
    void refreshNotifications();
  }

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

watch(status, (nextStatus) => {
  if (nextStatus === "authenticated") {
    void refreshNotifications();
    return;
  }

  showNotifications.value = false;
  resetNotifications();
});

watch(
  () => route.fullPath,
  () => {
    showNotifications.value = false;
  },
);

onBeforeUnmount(() => {
  document.removeEventListener("click", handleNotificationClickOutside);
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

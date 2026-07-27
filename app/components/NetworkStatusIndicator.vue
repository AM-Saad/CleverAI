<!-- components/NetworkStatusIndicator.vue -->
<template>
  <Transition name="slide-down">
    <div v-if="isDisconnected && showIndicator"
      class="fixed top-0 left-0 right-0 z-50 bg-warning text-white px-4 py-2 text-center text-sm font-medium">
      <div class="flex items-center justify-center gap-2">
        <svg class="w-4 h-4 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.268 16.5c-.77.833.192 2.5 1.732 2.5z" />
        </svg>
        <span>{{ resolvedMessage }}</span>
        <button v-if="showRetry"
          class="ml-2 px-2 py-1 bg-white/20 rounded-[var(--radius-md)] text-xs hover:bg-white/30 transition-colors focus-visible:ring-0 focus-visible:[outline-style:solid] focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[var(--ds-focus-outline-color)] disabled:opacity-60"
          :disabled="isConnecting" @click="handleRetry"> <!-- design-allow: inverse white-on-warning-banner button, no Ui* tone covers this on-color context -->
          {{ isConnecting ? 'Checking…' : 'Retry' }}
        </button>
      </div>
    </div>
  </Transition>
</template>

<script setup lang="ts">
interface Props {
  showRetry?: boolean;
  /** Overrides the state-derived copy. */
  message?: string;
  autoHide?: boolean;
  autoHideDelay?: number;
}

const props = withDefaults(defineProps<Props>(), {
  showRetry: false,
  message: "",
  autoHide: false,
  autoHideDelay: 5000,
});

const emit = defineEmits<{
  retry: [];
}>();

const {
  isOnline,
  isVerifiedOnline,
  isConnecting,
  hasCheckedReachability,
  verifyConnection,
} = useNetworkStatus();

/**
 * Reachability, not just navigator.onLine — a captive portal or dead link keeps
 * the browser reporting "online" while nothing actually resolves, and that
 * degraded state needs to be visible too.
 *
 * The unverified state is only meaningful once a check has actually resolved;
 * the monitor boots unverified, so reporting it earlier would flash this banner
 * on every cold start.
 */
const isDisconnected = computed(
  () =>
    !isOnline.value || (hasCheckedReachability.value && !isVerifiedOnline.value),
);

const resolvedMessage = computed(() => {
  if (props.message) return props.message;
  return isOnline.value
    ? "Can't reach the server. Your changes are saved locally."
    : "No internet connection. Your changes are saved locally.";
});

const showIndicator = ref(true);

// Auto-hide functionality
let hideTimeout: NodeJS.Timeout | null = null;

watch(
  isDisconnected,
  (disconnected) => {
    if (!disconnected) {
      showIndicator.value = false;
      if (hideTimeout) {
        clearTimeout(hideTimeout);
        hideTimeout = null;
      }
      return;
    }
    showIndicator.value = true;

    if (props.autoHide) {
      if (hideTimeout) clearTimeout(hideTimeout);
      hideTimeout = setTimeout(() => {
        showIndicator.value = false;
      }, props.autoHideDelay);
    }
  },
  // Cover the app opening while already offline: that is a starting state, not
  // a transition, so a lazy watcher would never show the banner.
  { immediate: true },
);

const handleRetry = () => {
  emit("retry");
  // Ask the monitor to re-check for real rather than faking an `online` event.
  void verifyConnection();
};

onUnmounted(() => {
  if (hideTimeout) {
    clearTimeout(hideTimeout);
  }
});
</script>

<style scoped>
.slide-down-enter-active,
.slide-down-leave-active {
  transition: transform 0.3s ease-out;
}

.slide-down-enter-from {
  transform: translateY(-100%);
}

.slide-down-leave-to {
  transform: translateY(-100%);
}
</style>

<!-- components/NetworkStatusIndicator.vue -->
<template>
  <Transition name="slide-down">
    <div
      v-if="!isOnline && showIndicator"
      class="fixed top-0 left-0 right-0 z-50 bg-amber-500 text-white px-4 py-2 text-center text-sm font-medium"
    >
      <div class="flex items-center justify-center gap-2">
        <svg
          class="w-4 h-4 animate-pulse"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.268 16.5c-.77.833.192 2.5 1.732 2.5z"
          />
        </svg>
        <span>{{ message }}</span>
        <button
          v-if="showRetry"
          class="ml-2 px-2 py-1 bg-white/20 rounded text-xs hover:bg-white/30 transition-colors"
          @click="handleRetry"
        >
          Retry
        </button>
      </div>
    </div>
  </Transition>
</template>

<script setup lang="ts">
interface Props {
  showRetry?: boolean;
  message?: string;
  autoHide?: boolean;
  autoHideDelay?: number;
}

const props = withDefaults(defineProps<Props>(), {
  showRetry: false,
  message: "No internet connection. Some features may be limited.",
  autoHide: false,
  autoHideDelay: 5000,
});

const emit = defineEmits<{
  retry: [];
}>();

const { isOnline } = useNetworkStatus();

const showIndicator = ref(true);

// Auto-hide functionality
let hideTimeout: NodeJS.Timeout | null = null;

watch(isOnline, (online) => {
  if (online) {
    showIndicator.value = false;
    if (hideTimeout) {
      clearTimeout(hideTimeout);
      hideTimeout = null;
    }
  } else {
    showIndicator.value = true;

    if (props.autoHide) {
      if (hideTimeout) clearTimeout(hideTimeout);
      hideTimeout = setTimeout(() => {
        showIndicator.value = false;
      }, props.autoHideDelay);
    }
  }
});

const handleRetry = () => {
  emit("retry");

  // Force check network status
  if (import.meta.client && navigator.onLine) {
    // Trigger online event manually
    window.dispatchEvent(new Event("online"));
  }
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

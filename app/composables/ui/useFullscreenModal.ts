/**
 * Composable for managing fullscreen modal state with transitions.
 * Provides a unified approach for fullscreen modals across the app.
 * 
 * Note: Named "useFullscreenModal" to avoid conflict with VueUse's "useFullscreen"
 */
export function useFullscreenModal<T extends string = string>() {
  const fullscreenId = ref<T | null>(null);
  const isTransitioning = ref(false);

  const TRANSITION_DURATION = 300; // ms - must match CSS transition

  /**
   * Open fullscreen for a specific item
   */
  function open(id: T) {
    if (isTransitioning.value) return;
    isTransitioning.value = true;
    fullscreenId.value = id;

    // Prevent background scroll
    if (typeof document !== "undefined") {
      document.body.style.overflow = "hidden";
    }

    setTimeout(() => {
      isTransitioning.value = false;
    }, TRANSITION_DURATION);
  }

  /**
   * Close fullscreen
   */
  function close() {
    if (isTransitioning.value) return;
    isTransitioning.value = true;
    fullscreenId.value = null;

    // Restore background scroll
    if (typeof document !== "undefined") {
      document.body.style.overflow = "";
    }

    setTimeout(() => {
      isTransitioning.value = false;
    }, TRANSITION_DURATION);
  }

  /**
   * Toggle fullscreen for a specific item
   */
  function toggle(id: T) {
    if (fullscreenId.value === id) {
      close();
    } else {
      open(id);
    }
  }

  /**
   * Check if a specific item is fullscreen
   */
  function isFullscreen(id: T): boolean {
    return fullscreenId.value === id;
  }

  /**
   * Check if any item is in fullscreen mode
   */
  const isOpen = computed(() => fullscreenId.value !== null);

  // ESC key handler - auto cleanup on unmount
  onMounted(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && fullscreenId.value) {
        close();
      }
    };

    if (typeof document !== "undefined") {
      document.addEventListener("keydown", handleEscape);

      onUnmounted(() => {
        document.removeEventListener("keydown", handleEscape);
        // Ensure scroll is restored on unmount
        document.body.style.overflow = "";
      });
    }
  });

  return {
    /** The ID of the currently fullscreen item, or null */
    fullscreenId: readonly(fullscreenId),
    /** Whether a transition is in progress (prevents double-clicks) */
    isTransitioning: readonly(isTransitioning),
    /** Whether any item is in fullscreen mode */
    isOpen,
    /** Open fullscreen for a specific item */
    open,
    /** Close fullscreen */
    close,
    /** Toggle fullscreen for a specific item */
    toggle,
    /** Check if a specific item is fullscreen */
    isFullscreen,
  };
}

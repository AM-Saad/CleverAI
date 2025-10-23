// composables/useNetworkStatus.ts
export const useNetworkStatus = () => {
  const isOnline = ref(true);
  const isConnecting = ref(false);

  // Check initial network status
  if (import.meta.client) {
    isOnline.value = navigator.onLine;

    // Listen for network changes
    const handleOnline = () => {
      isOnline.value = true;
      isConnecting.value = false;
    };

    const handleOffline = () => {
      isOnline.value = false;
      isConnecting.value = true;
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    // Cleanup on unmount
    onUnmounted(() => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    });
  }

  const waitForConnection = async (timeout = 5000): Promise<boolean> => {
    if (isOnline.value) return true;

    return new Promise((resolve) => {
      const timeoutId = setTimeout(() => {
        resolve(false);
      }, timeout);

      const checkConnection = () => {
        if (isOnline.value) {
          clearTimeout(timeoutId);
          resolve(true);
        }
      };

      const interval = setInterval(checkConnection, 100);

      setTimeout(() => {
        clearInterval(interval);
      }, timeout);
    });
  };

  const retryWithBackoff = async <T>(
    fn: () => Promise<T>,
    maxRetries = 3,
    baseDelay = 1000,
  ): Promise<T | null> => {
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error) {
        console.warn(`Attempt ${attempt + 1} failed:`, error);

        if (attempt === maxRetries - 1) {
          console.error("All retry attempts failed");
          return null;
        }

        // Wait for network if offline
        if (!isOnline.value) {
          console.log("Waiting for network connection...");
          const connected = await waitForConnection(
            baseDelay * Math.pow(2, attempt),
          );
          if (!connected) {
            console.warn("Network timeout, continuing with retry");
          }
        } else {
          // Exponential backoff
          await new Promise((resolve) =>
            setTimeout(resolve, baseDelay * Math.pow(2, attempt)),
          );
        }
      }
    }

    return null;
  };

  return {
    isOnline: readonly(isOnline),
    isConnecting: readonly(isConnecting),
    waitForConnection,
    retryWithBackoff,
  };
};

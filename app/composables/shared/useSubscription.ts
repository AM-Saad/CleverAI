// app/composables/shared/useSubscription.ts

// Global state - shared across all components
const subscriptionInfo = ref<SubscriptionInfo>({
  tier: "FREE",
  generationsUsed: 0,
  generationsQuota: 10,
  remaining: 10,
});
const isQuotaExceeded = ref(false);
const isLoading = ref(false);
const error = ref<string | null>(null);
const hasFetched = ref(false);

export function useSubscription() {
  // Update subscription info from API response headers
  const updateFromHeaders = (headers: Headers) => {
    const tier = headers.get("x-subscription-tier") || "FREE";
    const generationsUsed = parseInt(
      headers.get("x-generations-used") || "0",
      10
    );
    const generationsQuota = parseInt(
      headers.get("x-generations-quota") || "10",
      10
    );
    const remaining = parseInt(
      headers.get("x-generations-remaining") || "0",
      10
    );

    subscriptionInfo.value = {
      tier,
      generationsUsed,
      generationsQuota,
      remaining,
    };

    isQuotaExceeded.value = remaining <= 0 && tier === "FREE";
  };

  // Update subscription info from response data
  const updateFromData = (data: { subscription?: SubscriptionInfo }) => {
    if (data.subscription) {
      subscriptionInfo.value = data.subscription;
      isQuotaExceeded.value =
        data.subscription.remaining <= 0 && data.subscription.tier === "FREE";
    }
  };

  const handleApiError = (err: any) => {
    error.value = err?.data?.message || "An error occurred";

    // Check if this is a quota exceeded error
    if (err?.status === 402 || err?.data?.type === "QUOTA_EXCEEDED") {
      isQuotaExceeded.value = true;

      // Try to extract subscription info from error data
      if (err?.data?.subscription) {
        subscriptionInfo.value = err.data.subscription;
      }
    }
  };

  const resetQuotaError = () => {
    isQuotaExceeded.value = false;
    error.value = null;
  };

  // Fetch subscription status from server
  const fetchSubscriptionStatus = async () => {
    if (isLoading.value) return;

    isLoading.value = true;
    error.value = null;

    try {
      const response = await $fetch<{ subscription: SubscriptionInfo }>(
        "/api/subscription/status"
      );
      if (response?.subscription) {
        subscriptionInfo.value = response.subscription;
        isQuotaExceeded.value =
          response.subscription.remaining <= 0 &&
          response.subscription.tier === "FREE";
        hasFetched.value = true;
      }
    } catch (err: any) {
      // Don't fail silently - just use defaults
      console.warn("Failed to fetch subscription status:", err?.message);
    } finally {
      isLoading.value = false;
    }
  };

  return {
    subscriptionInfo,
    isQuotaExceeded,
    isLoading,
    error,
    hasFetched,
    updateFromHeaders,
    updateFromData,
    handleApiError,
    resetQuotaError,
    fetchSubscriptionStatus,
  };
}

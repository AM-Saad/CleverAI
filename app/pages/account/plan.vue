<template>
  <AccountPageFrame
    title="Plan & usage"
    subtitle="Credits, plan, and AI usage."
  >
    <UiSettingsGroup title="Plan & usage">
      <UiSettingsRow
        title="Credits & plan"
        :description="`${balance} credits available`"
        :trailing-text="subscriptionInfo.tier"
      >
        <template #leading>
          <UiIcon name="i-lucide-wallet" class="h-4 w-4" />
        </template>
        <template #control>
          <UiButton
            size="xs"
            variant="ghost"
            tone="neutral"
            @click="openWallet"
          >
            Manage
          </UiButton>
        </template>
      </UiSettingsRow>
      <UiSettingsRow
        title="AI generations"
        :description="`${subscriptionInfo.generationsUsed} of ${subscriptionInfo.generationsQuota} used`"
        :trailing-text="`${subscriptionInfo.remaining} left`"
      >
        <template #leading>
          <UiIcon name="i-lucide-sparkles" class="h-4 w-4" />
        </template>
      </UiSettingsRow>
      <UiSettingsRow
        clickable
        title="AI usage details"
        :description="
          usageOpen
            ? 'Hide recent usage tables'
            : 'View calls, tokens, and cost by date'
        "
        @click="usageOpen = !usageOpen"
      >
        <template #leading>
          <UiIcon name="i-lucide-chart-no-axes-column" class="h-4 w-4" />
        </template>
        <template #control>
          <UiIcon
            :name="usageOpen ? 'i-lucide-chevron-up' : 'i-lucide-chevron-down'"
            class="h-4 w-4 text-content-secondary"
          />
        </template>
      </UiSettingsRow>
    </UiSettingsGroup>

    <user-usage-statistics v-if="usageOpen" />
  </AccountPageFrame>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from "vue";

definePageMeta({ middleware: "auth" });

const creditsStore = useCreditsStore();
const subscriptionStore = useSubscriptionStore();

const usageOpen = ref(false);
const balance = computed(() => creditsStore.balance ?? 0);
const subscriptionInfo = computed(
  () => subscriptionStore.subscriptionInfo.value,
);

function openWallet() {
  creditsStore.openWallet();
}

onMounted(async () => {
  await Promise.all([
    creditsStore.fetchBalance(),
    subscriptionStore.fetchSubscriptionStatus(),
  ]);
});
</script>

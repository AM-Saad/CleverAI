<template>
  <UiPill clickable variant="soft" class-name="backdrop-blur-md" @click="creditsStore.openWallet()">
    <span class="text-sm font-medium bg-linear-to-r from-primary to-accent-blue bg-clip-text text-transparent flex items-center gap-1">
      <shared-icon name="generate" class="w-4 h-4 inline-block text-primary" />
      {{ balance }}
    </span>
  </UiPill>
</template>

<script setup lang="ts">
import { onMounted } from 'vue'
import { useCreditsStore } from '~/composables/useCreditsStore'
import { storeToRefs } from 'pinia'

const creditsStore = useCreditsStore()
const { balance } = storeToRefs(creditsStore)

onMounted(() => {
  creditsStore.fetchBalance()
})
</script>

<template>
  <div class="relative group">
    <button @click="creditsStore.openWallet()"
      class="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-surface/70 hover:border-primary/50 transition-all duration-[var(--duration-fast)] backdrop-blur-md active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ds-focus-outline-color)]">
      <span
        class="text-sm font-medium bg-linear-to-r from-primary to-accent-blue bg-clip-text text-transparent decoration-none flex items-center gap-1">
        <shared-icon name="generate" class="w-4 h-4 inline-block text-primary " />
        {{ balance }}
      </span>
    </button>
  </div>
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

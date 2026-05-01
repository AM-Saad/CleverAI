<template>
  <div class="relative group">
    <button @click="creditsStore.openWallet()"
      class="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/50 hover:border-primary/50 transition-all duration-300 backdrop-blur-md shadow-sm active:scale-90">
      <span
        class="text-sm font-medium bg-linear-to-r from-primary to-blue-500 bg-clip-text text-transparent decoration-none">
        <UIcon name="i-heroicons-sparkles" class="w-4 h-4 inline-block -mt-0.5 mr-1 text-primary animate-pulse" />
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

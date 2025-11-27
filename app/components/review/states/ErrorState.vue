<template>
  <div class="text-center py-12">
    <div class="text-red-600 mb-4">
      <Icon
        name="heroicons:exclamation-triangle"
        class="w-8 h-8 mx-auto mb-2"
      />
      {{ error }}
    </div>
    <button
      @click="$emit('clearError')"
      class="px-6 py-3 bg-red-600 hover:bg-red-700 text-white font-medium rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
    >
      Clear Error
    </button>
  </div>
</template>

<script setup lang="ts">
interface Props {
  error: string
}

defineProps<Props>()

defineEmits<{
  clearError: []
}>()
</script>

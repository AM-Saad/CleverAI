<template>
  <div class="flex justify-center">
    <button
      @click="$emit('reveal')"
      class="px-8 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-all duration-200 transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
      :disabled="isSubmitting"
      aria-label="Reveal the answer to this card"
    >
      <Icon name="heroicons:eye" class="w-5 h-5 inline mr-2" />
      Show Answer <span class="text-sm opacity-75">(Space)</span>
    </button>
  </div>
</template>

<script setup lang="ts">
interface Props {
  isSubmitting: boolean
}

defineProps<Props>()

defineEmits<{
  reveal: []
}>()
</script>

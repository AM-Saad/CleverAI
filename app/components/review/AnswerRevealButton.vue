<template>
  <div class="flex justify-center">
    <UButton @click="$emit('reveal')" color="primary" variant="solid" size="lg" :disabled="isSubmitting"
      icon="i-heroicons-eye" aria-label="Reveal the answer to this card">
      Show Answer <span class="text-sm opacity-75">(Space)</span>
    </UButton>
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

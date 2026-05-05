<template>
  <div class="text-center py-12">
    <div class="text-error mb-4">
      <Icon name="heroicons:exclamation-triangle" class="w-8 h-8 mx-auto mb-2" />
      {{ error }}
    </div>
    <UButton @click="$emit('clearError')" color="error" variant="solid">
      Clear Error
    </UButton>
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

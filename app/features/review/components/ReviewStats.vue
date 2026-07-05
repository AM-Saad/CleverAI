<template>
  <div class="flex items-end space-x-4 flex-wrap">
    <!-- Debug Toggle (Development Only) -->
    <DevOnly>
      <UiIconButton icon="i-lucide-settings" label="Toggle debug panel" variant="ghost" tone="warning"
        @click="$emit('toggleDebug')" />
    </DevOnly>

    <!-- Analytics Toggle -->
    <UiIconButton icon="i-lucide-chart-no-axes-column" label="Toggle analytics" variant="ghost" tone="neutral"
      @click="$emit('toggleAnalytics')" />

    <!-- Stats -->
    <div class="flex space-x-4 text-sm">
      <div class="text-center" aria-label="New cards">
        <div class="font-semibold text-info-text">{{ queueStats.new }}</div>
        <div class="text-content-secondary">New</div>
      </div>
      <div class="text-center" aria-label="Learning cards">
        <div class="font-semibold text-warning-text">
          {{ queueStats.learning }}
        </div>
        <div class="text-content-secondary">Learning</div>
      </div>
      <div class="text-center" aria-label="Due cards">
        <div class="font-semibold text-error-text">{{ queueStats.due }}</div>
        <div class="text-content-secondary">Due</div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
interface QueueStats {
  total: number
  new: number
  due: number
  learning: number
}

interface Props {
  queueStats: QueueStats
}

defineProps<Props>()

defineEmits<{
  toggleAnalytics: []
  toggleDebug: []
}>()
</script>

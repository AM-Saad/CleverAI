<template>
  <div class="flex items-end space-x-4 flex-wrap">
    <!-- Debug Toggle (Development Only) -->
    <DevOnly>
      <button @click="$emit('toggleDebug')"
        class="text-yellow-500 hover:text-yellow-700 dark:text-yellow-400 dark:hover:text-yellow-200 rounded-lg transition-colors"
        aria-label="Toggle debug panel" title="Debug Controls">
        <Icon name="heroicons:cog-6-tooth" class="w-5 h-5" />
      </button>
    </DevOnly>

    <!-- Analytics Toggle -->
    <button @click="$emit('toggleAnalytics')"
      class="text-content-secondary hover:text-content-on-surface rounded-[var(--radius-lg)] transition-colors"
      aria-label="Toggle analytics">
      <Icon name="heroicons:chart-bar" class="w-5 h-5" />
    </button>

    <!-- Stats -->
    <div class="flex space-x-4 text-sm">
      <div class="text-center" aria-label="New cards">
        <div class="font-semibold text-info">{{ queueStats.new }}</div>
        <div class="text-content-secondary">New</div>
      </div>
      <div class="text-center" aria-label="Learning cards">
        <div class="font-semibold text-warning">
          {{ queueStats.learning }}
        </div>
        <div class="text-content-secondary">Learning</div>
      </div>
      <div class="text-center" aria-label="Due cards">
        <div class="font-semibold text-error">{{ queueStats.due }}</div>
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

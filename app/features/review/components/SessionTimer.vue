<template>
  <div class="flex items-center space-x-2 text-sm text-gray-500 dark:text-gray-400">
    <Icon name="heroicons:clock" class="w-4 h-4" />
    <span>{{ formattedTime }}</span>
  </div>
</template>

<script setup lang="ts">
interface Props {
  /** Session time in seconds (optional - uses internal timer if not provided) */
  sessionTime?: number
}

const props = withDefaults(defineProps<Props>(), {
  sessionTime: undefined,
})

// Use internal timer only if no sessionTime prop provided
const internalTimer = props.sessionTime === undefined ? useSessionTimer() : null

const { formatTime } = useSessionTimer()

const formattedTime = computed(() => {
  const time = props.sessionTime ?? internalTimer?.sessionTime.value ?? 0
  return formatTime(time)
})
</script>

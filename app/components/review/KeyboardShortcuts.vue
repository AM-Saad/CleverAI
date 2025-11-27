<template>
  <div
    v-if="show"
    class="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4"
    role="dialog"
    aria-labelledby="shortcuts-title"
  >
    <div class="flex justify-between items-start">
      <div>
        <h3
          id="shortcuts-title"
          class="font-medium text-yellow-800 dark:text-yellow-200 mb-2"
        >
          Keyboard Shortcuts
        </h3>
        <div
          class="grid grid-cols-2 gap-4 text-sm text-yellow-700 dark:text-yellow-300"
        >
          <div v-for="shortcut in shortcuts" :key="shortcut.key">
            <kbd class="px-2 py-1 bg-yellow-200 dark:bg-yellow-800 rounded">
              {{ shortcut.key }}
            </kbd>
            {{ shortcut.description }}
          </div>
        </div>
      </div>
      <button
        @click="$emit('close')"
        class="text-yellow-600 hover:text-yellow-800 dark:text-yellow-400 dark:hover:text-yellow-200"
        aria-label="Close shortcuts help"
      >
        <Icon name="heroicons:x-mark" class="w-5 h-5" />
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
interface Shortcut {
  key: string
  description: string
}

interface Props {
  show: boolean
}

defineProps<Props>()

defineEmits<{
  close: []
}>()

const shortcuts: Shortcut[] = [
  { key: 'Space', description: 'Show Answer' },
  { key: '1-6', description: 'Grade Card' },
  { key: '← / →', description: 'Navigate' },
  { key: 'S', description: 'Skip' },
  { key: '?', description: 'Toggle Help' },
  { key: 'A', description: 'Analytics' },
]
</script>

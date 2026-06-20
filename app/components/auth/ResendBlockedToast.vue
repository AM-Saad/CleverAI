<script setup lang="ts">
interface Props {
  seconds: number
  attempts: number | null
}
const props = defineProps<Props>()
</script>
<template>
  <transition name="fade" mode="out-in">
    <UiOverlaySurface v-if="props.seconds > 0 && (props.attempts !== null && props.attempts <= 0)"
      kind="toast"
      layer="toast"
      size="sm"
      class-name="fixed bottom-4 left-1/2 -translate-x-1/2 rounded-[var(--radius-md)] bg-error text-white"
      role="status" aria-live="polite" aria-atomic="true">
      Resend blocked — wait {{ props.seconds }}s
    </UiOverlaySurface>
  </transition>

</template>
<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity .25s ease
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0
}
</style>

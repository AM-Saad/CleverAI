<script setup lang="ts">
interface Props {
  seconds: number
  attempts: number | null
}
const props = defineProps<Props>()
</script>
<template>
  <transition name="fade" mode="out-in">
    <div
      v-if="props.seconds > 0 && (props.attempts !== null && props.attempts <= 0)"
      class="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-md bg-red-600 text-white shadow-lg text-sm"
      role="status"
      aria-live="polite"
      aria-atomic="true"
    >
      Resend blocked — wait {{ props.seconds }}s
    </div>
  </transition>
  
</template>
<style scoped>
.fade-enter-active,.fade-leave-active{transition:opacity .25s ease}
.fade-enter-from,.fade-leave-to{opacity:0}
</style>

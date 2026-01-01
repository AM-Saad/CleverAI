<template>
  <Transition enter-active-class="transition-all duration-500 cubic-bezier(0.34, 1.56, 0.64, 1)"
    enter-from-class="opacity-0 scale-50 translate-y-10" enter-to-class="opacity-100 scale-100 translate-y-0"
    leave-active-class="transition-all duration-300 ease-in" leave-from-class="opacity-100 scale-100 translate-y-0"
    leave-to-class="opacity-0 scale-50 translate-y-10">
    <button v-if="visible" @click="handleClick"
      class="fixed bottom-6 right-6 z-40 flex items-center gap-2 px-3 py-2 rounded-lg shadow-[2px_20px_50px_rgba(var(--color-primary-rgb),0.8)] transition-all duration-300 active:scale-95 group overflow-hidden outline-0 select-none"
      aria-label="Open Learning Hub" title="Open Learning Hub">
      <!-- Premium Gradient Background -->
      <div
        class="absolute inset-0 bg-gradient-to-br from-primary  to-primary transition-all duration-500 group-hover:scale-110 outline-0">
      </div>

      <!-- Glassmorphism overlay -->
      <div
        class="absolute inset-0 bg-white/10 backdrop-blur-[2px] opacity-50 group-hover:opacity-20 transition-opacity">
      </div>

      <!-- Animated Border / Pulse -->
      <div class="absolute inset-0 border border-white/40 rounded-lg outline-0"></div>

      <!-- Content -->
      <div class="relative flex items-center gap-2.5">
        <div class=" rounded-lg bg-white/90 backdrop-blur-md">
          <icons-stars-generative class="w-4 h-4 text-white" />
        </div>
        <span class="text-light font-bold tracking-tight">Learning Hub</span>
      </div>

      <!-- Shine animation -->
      <div
        class="absolute -inset-x-full top-0 h-full w-1/2 bg-gradient-to-r from-transparent via-white/20 to-transparent -skew-x-12 group-hover:animate-shine">
      </div>
    </button>
  </Transition>
</template>

<script setup lang="ts">
interface Props {
  visible?: boolean;
}

withDefaults(defineProps<Props>(), {
  visible: true,
});

const emit = defineEmits<{
  click: [];
}>();

function handleClick() {
  emit("click");
}
</script>

<style scoped>
@keyframes shine {
  0% {
    left: -100%;
  }

  100% {
    left: 200%;
  }
}

.group-hover\:animate-shine:hover .group-hover\:animate-shine,
button:hover .group-hover\:animate-shine {
  animation: shine 0.8s ease-in-out;
}

/* Custom animation for the star icon bits if possible, but keep it simple for now */
</style>

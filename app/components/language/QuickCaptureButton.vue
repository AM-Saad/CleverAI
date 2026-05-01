<template>
  <Teleport to="body">
    <template v-if="enabled">
      <Transition name="fab">
        <button type="button" title="Quick translate"
          class="fixed bottom-6 right-6 z-30 w-12 h-12 rounded-full bg-primary text-white shadow-lg flex items-center justify-center hover:bg-primary/90 active:scale-95 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
          @click="_isOpen = true">
          <Icon name="i-lucide-languages" class="w-5 h-5" />
        </button>
      </Transition>

      <language-quick-capture-modal :show="_isOpen" @close="_isOpen = false" />
    </template>
  </Teleport>
</template>

<script setup lang="ts">
const { preferences, loadPreferences } = useLanguageCapture();
const { _isOpen } = useQuickCaptureModal();

const enabled = computed(() => preferences.value?.enabled ?? false);

onMounted(() => loadPreferences());
</script>

<style scoped>
.fab-enter-active,
.fab-leave-active {
  transition: all 0.2s ease;
}

.fab-enter-from,
.fab-leave-to {
  opacity: 0;
  transform: scale(0.5);
}
</style>

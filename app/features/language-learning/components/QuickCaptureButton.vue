<template>
  <Teleport to="body">
    <template v-if="enabled">
      <Transition name="fab">
        <UiIconButton icon="i-lucide-languages" label="Open quick translate" tone="primary" variant="solid"
          class="fixed right-6 z-[var(--z-popover)] h-12 w-12 rounded-full shadow-[var(--shadow-card-hover)] active:scale-[0.98]"
          style="bottom: calc(env(safe-area-inset-bottom, 0px) + var(--space-6));"
          @click="_isOpen = true" />
      </Transition>

      <QuickCaptureModal :show="_isOpen" @close="_isOpen = false" />
    </template>
  </Teleport>
</template>

<script setup lang="ts">
import QuickCaptureModal from "~/features/language-learning/components/QuickCaptureModal.vue";
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

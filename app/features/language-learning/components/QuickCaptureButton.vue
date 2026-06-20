<template>
  <Teleport to="body">
    <template v-if="enabled">
      <Transition name="fab">
        <button type="button" title="Quick translate" aria-label="Open quick translate"
          class="fixed right-6 z-[var(--z-popover)] flex h-12 w-12 items-center justify-center rounded-full bg-primary text-on-primary shadow-[var(--shadow-card-hover)] transition-[background-color,transform] duration-[var(--duration-fast)] hover:bg-primary-hover active:scale-[0.98] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ds-focus-outline-color)]"
          style="bottom: calc(env(safe-area-inset-bottom, 0px) + var(--space-6));"
          @click="_isOpen = true">
          <shared-icon name="translation" />
        </button>
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

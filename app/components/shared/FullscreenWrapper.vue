<template>
  <!-- Teleport both backdrop and container to body for proper stacking -->
  <Teleport to="body">
    <!-- Backdrop -->
    <Transition name="fs-backdrop">
      <div v-if="isOpen" class="fullscreen-backdrop" role="presentation" aria-hidden="true" @click="$emit('close')" />
    </Transition>

    <!-- Fullscreen container -->
    <Transition :name="disableAnimation ? '' : 'fs-card'">
      <div v-if="isOpen" ref="containerRef" class="fullscreen-container" role="dialog" aria-modal="true"
        :aria-label="ariaLabel">
        <!-- Sticky header -->
        <header v-if="$slots.header" class="fullscreen-header">
          <slot name="header" />
        </header>

        <!-- Scrollable content -->
        <div class="fullscreen-content">
          <slot />
        </div>

        <!-- Optional footer -->
        <footer v-if="$slots.footer" class="fullscreen-footer">
          <slot name="footer" />
        </footer>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
interface Props {
  /** Whether the fullscreen is open */
  isOpen: boolean;
  /** Aria label for accessibility */
  ariaLabel?: string;
  /** Disable animations (for reduced motion preference) */
  disableAnimation?: boolean;
  /** Max width of the fullscreen container */
  maxWidth?: string;
  /** Max height of the fullscreen container */
  maxHeight?: string;
}

const props = withDefaults(defineProps<Props>(), {
  ariaLabel: "Fullscreen content",
  disableAnimation: false,
  maxWidth: "1200px",
  maxHeight: "800px",
});

defineEmits<{
  close: [];
}>();

const containerRef = ref<HTMLElement | null>(null);

// Apply custom dimensions via CSS custom properties
const containerStyle = computed(() => ({
  "--fs-max-width": props.maxWidth,
  "--fs-max-height": props.maxHeight,
}));

// Expose container ref for parent components if needed
defineExpose({
  containerRef,
});
</script>

<style scoped>
/* ===== Backdrop ===== */
.fullscreen-backdrop {
  position: fixed;
  inset: 0;
  background-color: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(4px);
  z-index: 10;
  will-change: opacity, backdrop-filter;
}

/* Backdrop transitions */
.fs-backdrop-enter-active,
.fs-backdrop-leave-active {
  transition: all 0.3s ease-out;
}

.fs-backdrop-enter-from,
.fs-backdrop-leave-to {
  opacity: 0;
  backdrop-filter: blur(0px);
}

/* ===== Fullscreen Container ===== */
.fullscreen-container {
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 90vw;
  height: 100vh;
  max-width: var(--fs-max-width, 1200px);
  max-height: var(--fs-max-height, 95vh);
  z-index: 20;

  display: flex;
  flex-direction: column;
  overflow: hidden;

  background: var(--color-background, white);
  border-radius: 12px;
  border: 1px solid var(--color-border, rgba(0, 0, 0, 0.1));
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);

  will-change: transform, opacity;
}

/* Card transitions */
.fs-card-enter-active,
.fs-card-leave-active {
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.fs-card-enter-from,
.fs-card-leave-to {
  opacity: 0;
  transform: translate(-50%, -50%) scale(0.9);
}

.fs-card-enter-to,
.fs-card-leave-from {
  opacity: 1;
  transform: translate(-50%, -50%) scale(1);
}

/* ===== Header ===== */
.fullscreen-header {
  flex-shrink: 0;
  padding: 1rem 1.5rem;
  border-bottom: 1px solid var(--color-border, rgba(0, 0, 0, 0.1));
  background: inherit;
}

/* ===== Content ===== */
.fullscreen-content {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 1.5rem;

  /* Custom scrollbar */
  scrollbar-width: thin;
  scrollbar-color: rgba(156, 163, 175, 0.3) transparent;
}

.fullscreen-content::-webkit-scrollbar {
  width: 6px;
}

.fullscreen-content::-webkit-scrollbar-track {
  background: transparent;
}

.fullscreen-content::-webkit-scrollbar-thumb {
  background-color: rgba(156, 163, 175, 0.3);
  border-radius: 3px;
}

.fullscreen-content::-webkit-scrollbar-thumb:hover {
  background-color: rgba(156, 163, 175, 0.5);
}

/* ===== Footer ===== */
.fullscreen-footer {
  flex-shrink: 0;
  padding: 1rem 1.5rem;
  border-top: 1px solid var(--color-border, rgba(0, 0, 0, 0.1));
  background: inherit;
}

/* ===== Dark Mode ===== */
.dark .fullscreen-container {
  background: rgb(17, 24, 39);
  border-color: rgba(75, 85, 99, 0.3);
}

.dark .fullscreen-header,
.dark .fullscreen-footer {
  border-color: rgba(75, 85, 99, 0.3);
}

.dark .fullscreen-backdrop {
  background-color: rgba(0, 0, 0, 0.8);
}

/* ===== Mobile ===== */
@media (max-width: 768px) {
  .fullscreen-container {
    width: 99vw;
    height: 95vh;
    border-radius: 8px;
  }

  .fullscreen-header,
  .fullscreen-footer {
    padding: 0.5rem 1rem;
  }

  .fullscreen-content {
    padding: 1rem;
  }
}

/* ===== Reduced Motion ===== */
@media (prefers-reduced-motion: reduce) {

  .fullscreen-backdrop,
  .fullscreen-container {
    transition: none !important;
  }

  .fs-backdrop-enter-active,
  .fs-backdrop-leave-active,
  .fs-card-enter-active,
  .fs-card-leave-active {
    transition: none !important;
  }
}
</style>

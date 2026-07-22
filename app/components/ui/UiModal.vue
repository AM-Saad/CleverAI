<template>
  <Teleport to="body">
    <Transition name="ui-modal">
      <div v-if="open" class="ui-modal__mask">
        <div
          ref="panelEl"
          role="dialog"
          aria-modal="true"
          :aria-label="ariaLabel"
          tabindex="-1"
          class="ui-modal__panel"
          @keydown="onKeydown"
        >
          <UiOverlaySurface
            kind="modal"
            layer="modal"
            size="xs"
            class-name="max-h-[90dvh] overflow-auto p-0"
          >
            <div class="ui-modal__header">
              <slot name="header">
                <div class="flex min-w-0 flex-col gap-1">
                  <UiSubtitle
                    v-if="title"
                    class="flex items-center gap-2"
                    size="lg"
                    color="content-on-surface-strong"
                  >
                    <UiIcon v-if="icon" :name="icon" class="h-5 w-5" />
                    {{ title }}
                  </UiSubtitle>
                  <UiParagraph
                    v-if="description"
                    size="sm"
                    color="content-secondary"
                  >
                    {{ description }}
                  </UiParagraph>
                </div>
              </slot>
              <UiIconButton
                icon="i-lucide-x"
                label="Close dialog"
                size="xs"
                variant="ghost"
                class="shrink-0"
                @click="close"
              />
            </div>

            <div class="ui-modal__body">
              <slot name="body"><slot /></slot>
            </div>

            <div v-if="$slots.footer" class="ui-modal__footer">
              <slot name="footer" />
            </div>
          </UiOverlaySurface>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import type { IconName } from "~/utils/icons.generated";

const open = defineModel<boolean>("open", { default: false });
const props = defineProps<{
  title?: string;
  description?: string;
  icon?: IconName;
}>();
const emit = defineEmits<{ close: [] }>();

const panelEl = ref<HTMLElement | null>(null);
const ariaLabel = computed(() => props.title ?? "Dialog");
const { onKeydown } = useFocusTrap(open, panelEl, { onEscape: close });

function close() {
  open.value = false;
  emit("close");
}
</script>

<style scoped>
.ui-modal__mask {
  position: fixed;
  inset: 0;
  z-index: var(--z-modal);
  display: grid;
  place-items: center;
  background: var(--ds-backdrop-strong);
  padding: var(--space-4);
}

.ui-modal__panel {
  width: min(100%, 36rem);
}

.ui-modal__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-3);
  border-bottom: 1px solid var(--color-secondary);
  padding: var(--space-3);
}

.ui-modal__body,
.ui-modal__footer {
  padding: var(--space-3);
}

.ui-modal__footer {
  border-top: 1px solid var(--color-secondary);
}

.ui-modal-enter-active,
.ui-modal-leave-active {
  transition: opacity var(--duration-normal) var(--ease-standard);
}

.ui-modal-enter-from,
.ui-modal-leave-to {
  opacity: 0;
}

@media (prefers-reduced-motion: reduce) {
  .ui-modal-enter-active,
  .ui-modal-leave-active {
    transition: none;
  }
}
</style>

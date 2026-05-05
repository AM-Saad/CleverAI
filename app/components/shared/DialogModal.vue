<script setup lang="ts">
import type { IconName } from "~/utils/icons.generated";

const props = defineProps<{
  show: boolean;
  title?: string;
  description?: string;
  icon?: IconName;
}>();
const emit = defineEmits<{
  (event: "close"): void;
}>();

const panelEl = ref<HTMLElement | null>(null);
const ariaLabel = computed(() => props.title ?? "Dialog");

const { onKeydown } = useFocusTrap(computed(() => props.show), panelEl, {
  onEscape: () => emit("close"),
});
</script>

<template>
  <Teleport to="body">

    <Transition name="modal">
      <div v-if="props.show" class="modal-mask">
        <div ref="panelEl" role="dialog" aria-modal="true" :aria-label="ariaLabel" :aria-hidden="!props.show"
          :inert="!props.show" tabindex="-1" @keydown="onKeydown"
          class="inner bg-surface absolute left-[50%] top-[50%] md:w-2/3 lg:w-1/3 w-11/12 -translate-x-1/2 -translate-y-1/2 transform rounded-2xl shadow-lg z-50 overflow-auto">
          <div
            class="modal-header flex items-center justify-between font-medium text-content-on-surface border-b border-secondary bg-surface p-3.5 pb-2">
            <slot name="header">
              <div class="flex flex-col gap-1">
                <ui-subtitle v-if="props.title" class="flex items-center gap-1" size="lg" color="content-on-surface">
                  <Icon v-if="props.icon" :name="props.icon" :size="UI_CONFIG.ICON_SIZE" />
                  {{ props.title }}
                </ui-subtitle>
                <ui-paragraph v-if="props.description" size="sm">{{ props.description }}
                </ui-paragraph>
              </div>
            </slot>
            <u-button type="button" variant="ghost" size="xs" color="neutral" aria-label="Close dialog"
              class="modal-default-button place-self-start cursor-pointer" @click="$emit('close')">
              <u-icon name="mdi:close"></u-icon>
            </u-button>
          </div>

          <div class="modal-body p-3">
            <slot name="body" class="z-9999"> default body </slot>
          </div>

          <div class="modal-footer p-3">
            <slot name="footer">
              <!-- <button class="btn btn-small" @click="$emit('close')">Close</button> -->
            </slot>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style>
.modal-mask {
  position: fixed;
  z-index: 9999;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: rgb(2 6 23 / 80%);
  display: flex;
  transition: opacity 0.3s ease;
}

.modal-body {
  margin: 10px 0;
}

.modal-default-button {
  float: right;
}

/*
 * The following styles are auto-applied to elements with
 * transition="modal" when their visibility is toggled
 * by Vue.js.
 *
 * You can easily play with the modal transition by editing
 * these styles.
 */

.modal-enter-from {
  opacity: 0;
}

.modal-leave-to {
  opacity: 0;
}

.modal-enter-from .modal-container,
.modal-leave-to .modal-container {
  -webkit-transform: scale(1.1);
  transform: scale(1.1);
}
</style>

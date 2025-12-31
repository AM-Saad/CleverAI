<script setup lang="ts">
defineProps<{ show: boolean, title: string, description?: string, icon: string }>();
const emit = defineEmits<{
  (event: "close"): void;
}>();

onMounted(() => {
  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape") emit("close");
  });
});

onUnmounted(() => {
  window.removeEventListener("keydown", (e) => {
    if (e.key === "Escape") emit("close");
  });
});
</script>

<template>
  <Teleport to="body">

    <Transition name="modal">
      <div v-if="show" class="modal-mask">
        <div
          class="inner bg-white dark:bg-dark absolute left-[50%] top-[50%] w-96 -translate-x-1/2 -translate-y-1/2 transform rounded-md p-3 shadow-lg z-50">
          <div
            class="modal-header flex items-center justify-between font-medium text-muted dark:text-light border-b border-muted pb-1">
            <div class="flex flex-col gap-1">
              <ui-subtitle class="flex items-center gap-1" size="base" weight="semibold">
                <u-icon :name="icon" :size="UI_CONFIG.ICON_SIZE" />
                {{ title }}
              </ui-subtitle>
              <ui-paragraph v-if="description" size="xs" color="muted">{{ description }}
              </ui-paragraph>
            </div>
            <u-button variant="soft" size="xs" color="neutral"
              class="modal-default-button place-self-start cursor-pointer" @click="$emit('close')">
              <u-icon name="mdi:close"></u-icon>
            </u-button>
          </div>

          <div class="modal-body">
            <slot name="body" class="z-[9999]"> default body </slot>
          </div>

          <div class="modal-footer">
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

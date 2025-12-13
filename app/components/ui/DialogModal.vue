<script setup lang="ts">
const props = defineProps<{ show: boolean }>();
const emit = defineEmits<{
  (event: "close"): void;
}>();

const handleKeydown = (e: KeyboardEvent) => {
  if (e.key === "Escape" && props.show) {
    emit("close");
  }
};

onMounted(() => {
  window.addEventListener("keydown", handleKeydown);
});

onUnmounted(() => {
  window.removeEventListener("keydown", handleKeydown);
});
</script>

<template>
  <Transition name="modal">
    <div v-if="show" class="modal-mask">
      <div
        class="inner dark:bg-dark bg-light absolute left-[50%] top-[50%] min-w-96 -translate-x-1/2 -translate-y-1/2 transform rounded-lg p-3 shadow-lg">
        <div class="modal-header flex items-center justify-between ">
          <slot name="header"> default header </slot>
          <button class="modal-default-button place-self-start p-1 dark:text-gray-400 cursor-pointer"
            @click="$emit('close')">
            <icon name="mdi:close" />
          </button>
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
</template>

<style>
.modal-mask {
  position: fixed;
  z-index: 9999;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: rgba(0, 0, 0, 0.7);
  display: flex;
  transition: opacity 0.3s ease;
}

.modal-body {
  margin: 20px 0;
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

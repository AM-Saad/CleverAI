<script setup lang="ts">
const props = defineProps({
  show: {
    type: Boolean,
    default: false,
  },
  needGuide: {
    type: String,
    default: "Microphone",
  },
})

const show = ref(props.show)

const emit = defineEmits<{
  (event: "close"): void
}>()

const gotit = (): void => {
  emit("close")
}
</script>

<template>
  <Teleport to="body">
    <UiDialogModal :show="show" @close="gotit">
      <template #header>
        <div class="title text-xl font-bold">
          Get {{ needGuide }} Permission
        </div>
        <div class="desc my-2 text-sm text-gray-500">
          Please click the lock button in the browser address bar to set
          permissions.
        </div>
      </template>

      <template #body>
        <video
          v-if="needGuide === 'Microphone'"
          class="m-auto block w-11/12 rounded shadow"
          src="@/assets/videos/allow-mic.mp4"
          muted
          autoplay
          loop
        ></video>
        <video
          v-if="needGuide === 'Webcam'"
          class="m-auto block w-11/12 rounded shadow"
          src="@/assets/videos/allow-cam.mp4"
          muted
          autoplay
          loop
        ></video>
      </template>
    </UiDialogModal>
  </Teleport>
</template>

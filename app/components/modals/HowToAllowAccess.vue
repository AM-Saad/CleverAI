<script setup lang="ts">
import allowMicVideo from "~/assets/videos/allow-mic.mp4";
import allowCamVideo from "~/assets/videos/allow-cam.mp4";

const props = defineProps({
  show: {
    type: Boolean,
    default: false,
  },
  needGuide: {
    type: String,
    default: "Microphone",
  },
});

const show = ref(props.show);

const emit = defineEmits<{
  (event: "close"): void;
}>();

const gotit = (): void => {
  emit("close");
};
</script>

<template>
  <Teleport to="body">
    <shared-dialog-modal :show="show" @close="gotit">
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
        <video v-if="needGuide === 'Microphone'" class="m-auto block w-11/12 rounded shadow" :src="allowMicVideo" muted
          autoplay loop />
        <video v-if="needGuide === 'Webcam'" class="m-auto block w-11/12 rounded shadow" :src="allowCamVideo" muted
          autoplay loop />
      </template>
    </shared-dialog-modal>
  </Teleport>
</template>

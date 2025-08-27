<script setup lang="ts">
defineProps({
  show: {
    type: Boolean,
    default: false,
  },
})

const dontShow = ref(false)

const emit = defineEmits(["gotit"])

const gotit = (): void => {
  if (dontShow.value) {
    localStorage.setItem("guideDismissed", "true")
  } else {
    localStorage.setItem("guideDismissed", "false")
  }
  emit("gotit")
}
</script>

<template>
  <Teleport to="body">
    <!-- use the modal component, pass in the prop -->
    <UiDialogModal :show="show" @close="gotit">
      <template #header>
        <div class="flex flex-col">
          <div class="title text-xl font-bold">Check "Share Audio" Box</div>
          <div class="desc my-2 text-sm text-gray-500 dark:text-gray-400">
            Please check "Share Audio" box to record system audio.
          </div>
        </div>
      </template>
      <template #body>
        <video
          src="@/assets/videos/share-sound.mp4"
          muted
          autoplay
          loop
        ></video>
        <div class="my-2 flex justify-between gap-3">
          <div class="flex items-center gap-2">
            <input
              id="dontShow"
              type="checkbox"
              name="dontshow"
              @click="dontShow = !dontShow"
            />
            <label for="dontShow" class="dark:text-gray-400"
              >Don't Show Again</label
            >
          </div>
        </div>
      </template>
      <template #footer>
        <button class="btn btn-small bg-theme" @click="gotit">Got it</button>
      </template>
    </UiDialogModal>
  </Teleport>
</template>

<style scoped>
.inner video {
  margin: auto;
  display: block;
  max-width: 90%;
  box-shadow: 0 0 6px -1px #999;
  padding: 12px;
  border-radius: 10px;
}

@media only screen and (max-width: 767px) and (min-width: 320px) {
  .inner {
    width: 90%;
  }
}
</style>

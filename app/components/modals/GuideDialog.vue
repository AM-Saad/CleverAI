<script setup lang="ts">
import shareSoundVideo from "~/assets/videos/share-sound.mp4";

defineProps({
  show: {
    type: Boolean,
    default: false,
  },
});

const dontShow = ref(false);

const emit = defineEmits(["gotit"]);

const gotit = (): void => {
  if (dontShow.value) {
    localStorage.setItem("guideDismissed", "true");
  } else {
    localStorage.setItem("guideDismissed", "false");
  }
  emit("gotit");
};
</script>

<template>
  <Teleport to="body">
    <!-- use the modal component, pass in the prop -->
    <UiModal :open="show" @close="gotit">
      <template #header>
        <div class="flex flex-col">
          <div class="title text-xl font-bold">Check "Share Audio" Box</div>
          <div class="desc my-2 text-sm text-content-secondary">
            Please check "Share Audio" box to record system audio.
          </div>
        </div>
      </template>
      <template #body>
        <video :src="shareSoundVideo" muted autoplay loop />
        <div class="my-2 flex justify-between gap-3">
          <UiCheckbox v-model="dontShow" label="Don't Show Again" />
        </div>
      </template>
      <template #footer>
        <UiButton tone="primary" @click="gotit">Got it</UiButton>
      </template>
    </UiModal>
  </Teleport>
</template>

<style scoped>
.inner video {
  margin: auto;
  display: block;
  max-width: 90%;
  box-shadow: var(--shadow-dropdown);
  padding: 12px;
  border-radius: 10px;
}

@media only screen and (max-width: 767px) and (min-width: 320px) {
  .inner {
    width: 90%;
  }
}
</style>

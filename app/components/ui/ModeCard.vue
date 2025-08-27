<template>
  <button
    class="mode focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:focus-visible:ring-white"
    :class="{ active: currentMode === mode }"
    :tabindex="tabIndex"
    @dblclick="switchComponent('Options', mode)"
    @click="changeScene(mode)"
  >
    <NuxtImg
      :src="full_image"
      :alt="title"
      :placeholder="[30, 20]"
      class="h-8 w-8"
    />
    <h3>{{ title }}</h3>
  </button>
</template>

<script setup lang="ts">
import { useMainStore } from "~/store"
import { SCENE } from "~/utils"

const props = defineProps({
  image: {
    type: String,
    required: true,
  },
  title: {
    type: String,
    required: true,
  },
  mode: {
    type: String as PropType<SCENE>,
    default: SCENE.SCREEN_AND_WEBCAM,
  },
  tabIndex: {
    type: Number,
    default: 1,
  },
})
const emit = defineEmits(["switch"])

const store = useMainStore()
const currentMode = computed(() => store.mode)

const full_image = `/images/${props.image}`

// Methods
const switchComponent = (comp: string, mode?: SCENE): void => {
  if (mode) store.changeMode(mode)
  emit("switch", comp)
}

const changeScene = (mode: SCENE): void => store.changeMode(mode)
</script>

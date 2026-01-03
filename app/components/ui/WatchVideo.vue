<script setup>
import { ref } from 'vue'
import { AnimatePresence, motion } from 'motion-v'
const isVisible = ref(true)
</script>

<template>
  <div class="container place-self-end">
    <AnimatePresence :initial="false">
      <motion.div v-if="isVisible" :initial="{ opacity: 0, scale: 0 }" :animate="{ opacity: 1, scale: 1 }"
        :exit="{ opacity: 0, scale: 0 }" class="box" key="box" />
    </AnimatePresence>

    <motion.button class="button" @click="isVisible = !isVisible" :whilePress="{ y: 1 }">
      <span class="font-light text-sm text-dark dark:text-light">
        Watch us
      </span>
      <div
        class="w-10 h-10 rounded-full border dark:border-light flex items-center justify-center hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer">
        <u-icon name="mdi:play" class="m-auto dark:text-light" />
      </div>
    </motion.button>
  </div>
</template>

<style>
.container {
  display: flex;
  flex-direction: column;
  width: 130px;
  height: 160px;
  position: relative;
}

.box {
  width: 100px;
  height: 100px;
  background-color: #0cdcf7;
  border-radius: 10px;
}

.button {
  display: flex;
  align-items: center;
  gap: 4px;
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
}
</style>

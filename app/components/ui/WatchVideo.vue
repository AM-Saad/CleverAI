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

    <motion.button
      class="button rounded-[var(--radius-md)] focus-visible:ring-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ds-focus-outline-color)]"
      @click="isVisible = !isVisible"
      :whilePress="{ y: 1 }"
    >
      <span class="font-light text-sm text-content-on-background">
        Watch us
      </span>
      <div
        class="flex h-10 w-10 cursor-pointer items-center justify-center rounded-full border border-secondary transition-colors hover:bg-surface-subtle">
        <u-icon name="mdi:play" class="m-auto text-content-on-background" />
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
  background-color: var(--color-accent-cyan);
  border-radius: var(--radius-lg);
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

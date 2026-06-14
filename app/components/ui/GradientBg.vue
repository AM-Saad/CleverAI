<template>
  <motion.div :initial="{ opacity: 0, height: 0 }" :animate="{ opacity: 1, height: '90%' }" :transition="{
    duration: 1.5,
    delay: 1,
    height: {
      type: 'spring',

    },
  }"
    class="absolute animate-pulse bg-linear-to-r blur-lg  from-[var(--color-accent-cyan)] left-1/2 -translate-x-1/2 top-1/2 -translate-y-1/2 opacity-50 rounded-[var(--radius-lg)] to-error/40 transition-all w-[calc(100%-3.5rem)] h-[90%] will-change-auto">
  </motion.div>

  <!-- animate to h-full -->
  <!-- <div class="absolute left-0 bottom-0 w-full  delay-500 h-full slide-in-from-bottom-translate-full
               rounded-[var(--radius-xl)] bg-gradient-to-r from-[var(--color-accent-blue)] via-[var(--color-accent-purple)] to-[var(--color-accent-pink)] bg-[length:400%_400%]">
            </div> -->
  <!-- <motion.div :initial="{ opacity: 0, height: 0 }" :animate="{ opacity: 1, height: '100%' }" :transition="{
    duration: 1.5,
    scale: {
      delay: 2,

      type: 'spring',
      bounce: 0.1,
    },
  }" class="absolute bg-[length:100%] animate-rotate-180
    bg-gradient-to-l bottom-0 from-[var(--color-accent-cyan)]/70 h-full left-0 rounded-[var(--radius-2xl)] to-error/50 w-full">
  </motion.div> -->
</template>

<script setup lang="ts">
import { motion } from "motion-v";
</script>

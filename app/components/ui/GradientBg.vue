<template>
  <motion.div :initial="{ opacity: 0, height: 0 }" :animate="{ opacity: 1, height: '90%' }" :transition="{
    duration: 1.5,
    delay: 1,
    height: {
      type: 'spring',

    },
  }"
    class="absolute animate-pulse bg-linear-to-r blur-lg  from-[#00e2ff] left-1/2 -translate-x-1/2 top-1/2 -translate-y-1/2 opacity-50 rounded-lg to-red-600/40 transition-all w-[calc(100%-3.5rem)] h-[90%] will-change-auto">
  </motion.div>

  <!-- animate to h-full -->
  <!-- <div class="absolute left-0 bottom-0 w-full  delay-500 h-full slide-in-from-bottom-translate-full 
               rounded-xl bg-gradient-to-r from-blue-400 via-purple-500 to-pink-500 bg-[length:400%_400%]">
            </div> -->
  <!-- <motion.div :initial="{ opacity: 0, height: 0 }" :animate="{ opacity: 1, height: '100%' }" :transition="{
    duration: 1.5,
    scale: {
      delay: 2,

      type: 'spring',
      bounce: 0.1,
    },
  }" class="absolute bg-[length:100%] animate-rotate-180
    bg-gradient-to-l bottom-0 from-[#00e2ff]/70 h-full left-0 rounded-[0.55rem] to-error/50 w-full">
  </motion.div> -->
</template>

<script setup lang="ts">
import { motion } from "motion-v";
</script>

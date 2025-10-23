<script setup>
import { motion } from "motion-v";
</script>

<template>
  <motion.button
    :while-hover="{ scale: 1.1 }"
    :while-press="{ scale: 0.9 }"
    :transition="{
      duration: 0.1,
    }"
    class="btn bg-primary text-white"
  >
    <slot />
  </motion.button>
</template>

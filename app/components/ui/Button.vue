<script setup>
import { motion } from "motion-v"
</script>

<template>
    <motion.button :whileHover="{ scale: 1.1 }" :whilePress="{ scale: 0.9 }" :transition="{
        duration: .1,

    }" class="btn bg-primary text-white">
        <slot />
    </motion.button>
</template>

<script setup lang="ts">
import { motion } from "motion-v";
</script>

<template>
  <section id="friction" className="w-full py-24 md:py-32 lg:py-40 relative z-20">
    <div className="container mx-auto px-4 md:px-6">
      <div className="mx-auto max-w-4xl space-y-8 text-center">
        <div className="space-y-4">
          <h2 className="font-headline text-4xl font-bold tracking-tighter sm:text-5xl md:text-6xl dark:text-white">
            You take notes.
          </h2>
          <h2
            className="font-headline text-4xl font-bold tracking-tighter text-muted-foreground sm:text-5xl md:text-6xl dark:text-white">
            You mean to review them.
          </h2>
          <h2
            className="font-headline text-4xl font-bold tracking-tighter text-muted-foreground/50 sm:text-5xl md:text-6xl dark:text-white">
            You don’t.
          </h2>
        </div>

        <div className="relative mx-auto h-64 w-full max-w-2xl">
          <div className="absolute inset-0 z-10 bg-linear-to-t from-background via-background/30 to-background" />
          <motion.div :initial="{ opacity: 0, y: 50, rotate: -3 }" :while-in-view="{ opacity: 0.7, y: 0, rotate: -3 }"
            :viewport="{ once: true }" :transition="{ duration: 0.5, delay: 0.1 }"
            class="absolute left-1/4 top-0 w-1/2 bg-secondary/30 p-4 shadow-md rounded">
            <p class="text-sm text-black">
              Idea for app: A service that reminds you to water your plants.
            </p>
          </motion.div>
          <motion.div :initial="{ opacity: 0, y: 50, rotate: 2 }" :while-in-view="{ opacity: 0.5, y: 0, rotate: 2 }"
            :viewport="{ once: true }" :transition="{ duration: 0.5, delay: 0.2 }"
            class="absolute left-[10%] top-1/3 w-2/3 bg-secondary/30 p-4 shadow-md rounded">
            <p class="text-sm text-black">
              Meeting notes: Follow up with Sarah about Q3 budget. Project Titan is on track.
            </p>
          </motion.div>
          <motion.div :initial="{ opacity: 0, y: 50, rotate: -5 }" :while-in-view="{ opacity: 0.3, y: 0, rotate: -5 }"
            :viewport="{ once: true }" :transition="{ duration: 0.5, delay: 0.3 }"
            class="absolute left-[30%] top-2/3 w-1/2 bg-secondary/30 p-4 shadow-md rounded">
            <p class="text-sm text-black">
              "The quick brown fox jumps over the lazy dog." A classic pangram for testing fonts.

            </p>
          </motion.div>
        </div>
      </div>
    </div>
  </section>
</template>
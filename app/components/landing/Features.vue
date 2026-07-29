<script setup lang="ts">
import { motion } from 'motion-v'
import BlurReveal from '~/components/ui/blur-reveal/BlurReveal.vue';

const featuresList = [
  {
    title: "Notes + Study Together",
    description: "Jot text. Structure workspaces.",
    icon: 'notebook-pen'
  },
  {
    title: 'Smart Flashcard Generator',
    description: 'Select any text and auto-generate using AI.',
    // The sparkle badge marks the AI-generated counterpart of 'Manual Card Mode'
    // below, which uses the same deck mark without it.
    icon: 'layers-ai'
  },
  {
    title: 'Spaced Repetition',
    description: 'Automated review intervals based on your performance.',
    icon: 'calendar-clock'
  },
  {
    title: 'Manual Card Mode',
    description: 'Create your own cards anytime.',
    icon: 'layers'
  },
  {
    title: 'Timing Config',
    description: 'Control when reminders arrive.',
    icon: 'clock'
  },
  {
    title: 'AI Chat Assistant',
    description: 'Get help understanding and memorizing content.',
    icon: 'sparkles'
  },
]
</script>

<template>
  <div class="relative xl:w-5/6 mx-auto my-32 px-4">
    <!-- Header Section -->
    <div class="max-w-4xl mx-auto text-center mb-20 relative z-10">
      <blur-reveal :delay="0.2">
        <h2 class="text-5xl md:text-7xl font-black text-dark dark:text-light mb-6 tracking-tight leading-none">
          Features That <br class="hidden md:block" />
          <span
            class="text-transparent bg-clip-text bg-gradient-to-r from-primary to-blue-600 dark:from-sky-400 dark:to-primary">
            Boost Your Learning
          </span>
        </h2>
        <p class="text-lg text-neutral-500 dark:text-neutral-400 max-w-2xl mx-auto">
          Everything you need to capture knowledge, retain it forever, and master any subject in record time.
        </p>
      </blur-reveal>
    </div>

    <!-- Features Grid -->
    <div class="grid md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8 mx-auto relative z-10">
      <motion.div v-for="(feature, idx) in featuresList" :key="feature.title" :initial="{ opacity: 0, y: 50 }"
        :while-in-view="{ opacity: 1, y: 0 }" :viewport="{ once: true, margin: '-50px' }"
        :transition="{ duration: 0.5, delay: idx * 0.1 }"
        class="group relative bg-white  border border-neutral-200  p-8 rounded-[2rem] overflow-hidden hover:shadow-2xl hover:shadow-primary/5 hover:-translate-y-1 transition-all duration-300">
        <!-- Background Decoration -->
        <div
          class="absolute -right-10 -top-10 w-40 h-40 bg-gradient-to-br from-primary/5 to-transparent  rounded-full group-hover:scale-150 transition-transform duration-700 ease-out pointer-events-none" />

        <div class="relative z-10 flex flex-col h-full">
          <div
            class="w-14 h-14 bg-primary/10 rounded-2xl flex items-center justify-center mb-6 text-primary  group-hover:rotate-6 transition-transform duration-300">
            <UiIcon :name="feature.icon" size="xl" />
          </div>

          <h3 class="text-xl font-bold text-dark mb-3 group-hover:text-primary transition-colors">
            {{ feature.title }}
          </h3>

          <p class="text-neutral-500 leading-relaxed text-sm grow">
            {{ feature.description }}
          </p>
        </div>
      </motion.div>
    </div>

    <!-- Background Blob -->
    <div
      class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full max-w-4xl max-h-[800px] z-0 pointer-events-none opacity-20 dark:opacity-10">
      <div class="absolute inset-0 bg-gradient-to-tr from-primary/30 to-blue-500/30 rounded-full blur-[120px]" />
    </div>
  </div>
</template>

<template>
  <div class="inline-flex m-auto w-full justify-center items-center gap-6 p-4">
    <motion.article class=" rounded-xl w-full max-w-md h-64 overflow-hidden  shadow-sm relative bg-white dark:bg-dark"
      :animate="step === 'converted' ? { borderColor: 'var(--color-primary)', scale: 1.02 } : { borderColor: 'var(--color-muted)', scale: 1 }"
      :transition="{ duration: 0.5, ease: 'easeInOut' }">
      <landing-glow-border :color="['#A07CFE', '#FE8FB5', '#FFBE7B']" :border-radius="8" />

      <header class="flex items-center justify-between h-10 px-4 border-b border-muted ">
        <motion.span class="text-sm font-medium text-muted" :animate="{ opacity: 1 }" :key="headerText">
          {{ headerText }}
        </motion.span>
        <div class="flex gap-1">
          <div class="w-2 h-2 rounded-full bg-red-400/50"></div>
          <div class="w-2 h-2 rounded-full bg-yellow-400/50"></div>
          <div class="w-2 h-2 rounded-full bg-green-400/50"></div>
        </div>
      </header>

      <section class="p-6 relative h-full">

        <!-- Note View (Typing/Highlight/Menu) -->
        <Transition mode="out-in" :css="false" @leave="onNoteViewLeave">
          <motion.div v-if="['typing', 'highlighting', 'menu', 'clicking'].includes(step)" :key="'note'"
            class="relative inline-block w-full will-change-transform">
            <div class="overflow-hidden whitespace-nowrap pr-1 font-mono text-lg dark:text-light relative z-10 w-fit"
              :class="step === 'typing' ? 'border-r-2 border-primary animate-typing' : ''">
              Writing notes helps reinforce learning.
            </div>

            <!-- Highlighter -->
            <motion.div v-if="['highlighting', 'menu', 'clicking'].includes(step)"
              class="absolute top-0 left-0 h-full bg-primary/20 rounded-sm -z-0" :initial="{ width: 0 }"
              :animate="{ width: '100%' }" :transition="{ duration: 1.2, ease: 'easeInOut' }"
              @motioncomplete="onHighlightComplete" />
          </motion.div>

          <!-- List View Stage -->
          <motion.div v-else-if="['list', 'clicking-generate'].includes(step)" :key="'list'"
            class="flex flex-col h-full -mt-2 will-change-transform">
            <motion.div :initial="{ opacity: 0, y: 10 }" :animate="{ opacity: 1, y: 0 }" :transition="{ duration: 0.4 }"
              class="flex items-center justify-between mb-4">
              <h3 class="text-xs font-bold text-muted uppercase tracking-wider">Current Material</h3>
              <span class="text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded-full font-bold">1 Item</span>
            </motion.div>

            <div class="flex-1 overflow-hidden">
              <motion.div :initial="{ scale: 0.95, opacity: 0, y: 20 }" :animate="{ scale: 1, opacity: 1, y: 0 }"
                :transition="{
                  type: 'spring',
                  stiffness: 100,
                  damping: 18,
                  delay: 0.2
                }"
                class="p-3 bg-primary/5 border border-primary/20 rounded-lg mb-4 relative shadow-sm will-change-transform">
                <p class="text-xs text-dark font-medium leading-relaxed italic dark:text-light">
                  "Writing notes helps reinforce learning."
                </p>
                <div class="absolute right-1 top-1">
                  <span class="flex h-2 w-2">
                    <span
                      class="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                    <span class="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
                  </span>
                </div>
              </motion.div>
            </div>

            <motion.div :initial="{ opacity: 0, y: 10 }" :animate="{ opacity: 1, y: 0 }"
              :transition="{ delay: 0.6, duration: 0.4 }" class="pb-4 mb-2">
              <motion.button
                class="w-full py-2.5 bg-primary text-white dark:text-dark text-xs font-bold rounded-lg shadow-lg shadow-primary/20 flex items-center justify-center gap-2 relative overflow-hidden will-change-transform"
                :animate="step === 'clicking-generate' ? { scale: 0.95 } : { scale: 1 }"
                :transition="{ duration: 0.15 }">
                <u-icon name="i-heroicons-sparkles-solid" class="w-4 h-4" />
                Generate Flashcards

                <!-- Click Pulse Indicator -->
                <motion.div v-if="step === 'clicking-generate'" :initial="{ scale: 0, opacity: 0.6 }"
                  :animate="{ scale: 8, opacity: 0 }" :transition="{ duration: 0.6, ease: 'easeOut' }"
                  class="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white/50 dark:bg-black/50 pointer-events-none" />
              </motion.button>
            </motion.div>
          </motion.div>

          <!-- Generating Stage -->
          <motion.div v-else-if="step === 'generating'" :key="'generating'"
            class="flex flex-col items-center justify-center h-full -mt-10 gap-2 will-change-transform">
            <div class="relative">
              <div class="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin"></div>
              <div class="absolute inset-0 flex items-center justify-center">
                <span class="i-heroicons-sparkles-solid w-5 h-5 text-primary animate-pulse" />
              </div>
            </div>
            <span class="text-xs font-bold text-primary animate-pulse">Generating Flashcards...</span>
          </motion.div>

          <!-- Converted Stage -->
          <motion.div v-else-if="step === 'converted'" :key="'converted'"
            class="flex flex-col items-center justify-center h-full -mt-10 gap-4 will-change-transform">
            <motion.div :initial="{ scale: 0, rotate: -10 }" :animate="{ scale: 1, rotate: 0 }"
              :transition="{ type: 'spring', stiffness: 150, damping: 12, delay: 0.2 }"
              class="p-4 bg-primary/10 rounded-2xl border-2 border-primary/20 text-primary">
              <u-icon name="i-heroicons-sparkles-solid" class="w-12 h-12" />
            </motion.div>
            <motion.div :initial="{ opacity: 0, y: 10 }" :animate="{ opacity: 1, y: 0 }"
              :transition="{ delay: 0.4, duration: 0.5 }" class="text-center">
              <h3 class="font-bold text-primary text-lg">Flashcard Created!</h3>
              <p class="text-sm text-muted px-4 italic">AI processed your material into active recall cards.</p>
            </motion.div>
          </motion.div>
        </Transition>
        <!-- Context Menu / Interaction -->
        <Transition :css="false" @enter="onMenuEnter" @leave="onMenuLeave">
          <motion.div v-if="step === 'menu' || step === 'clicking'"
            class="absolute top-12 right-6 z-20 p-1 border border-muted bg-white rounded-xl shadow-2xl min-w-[170px] will-change-transform">
            <ul class="flex flex-col gap-1">
              <li
                class="group flex items-center justify-between text-xs font-bold p-2.5 rounded-lg hover:bg-primary/5 text-dark cursor-pointer transition-all relative overflow-hidden">
                <span class="flex items-center gap-2">
                  <span class="i-heroicons-plus-circle w-4 h-4 text-primary" />
                  Add to Material
                </span>

                <!-- Click Pulse Indicator -->
                <motion.div v-if="step === 'clicking'" :initial="{ scale: 0, opacity: 0.6 }"
                  :animate="{ scale: 5, opacity: 0 }" :transition="{ duration: 0.5, ease: 'easeOut' }"
                  class="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-primary/40 pointer-events-none"
                  @motioncomplete="onAddedToMaterial" />
              </li>
              <li class="flex items-center gap-2 text-xs font-medium p-2.5 rounded-lg text-muted/30 cursor-not-allowed">
                <span class="i-heroicons-chat-bubble-bottom-center-text w-4 h-4" />
                Explain this
              </li>
            </ul>
          </motion.div>
        </Transition>
      </section>
    </motion.article>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue';
import { motion, animate } from "motion-v";

type Step = 'typing' | 'highlighting' | 'menu' | 'clicking' | 'list' | 'clicking-generate' | 'generating' | 'converted';
const step = ref<Step>('typing');

// Animation timing configuration (in ms)
const TIMING = {
  typing: 3500,
  highlighting: 1200,
  menuDelay: 1000,
  clickingDelay: 2000,
  listDelay: 800,
  generateDelay: 3800,
  generating: 3200,
  converted: 2500,
  resetDelay: 1500
} as const;

let animationTimers: NodeJS.Timeout[] = [];
let isTransitioning = false;

const headerText = computed(() => {
  if (step.value === 'converted') return 'Flashcard';
  if (step.value === 'generating') return 'AI Processing...';
  if (['list', 'clicking-generate'].includes(step.value)) return 'Study Material';
  return 'Notes';
});

// Transition handlers for smoother animations
const onNoteViewLeave = (el: Element, done: () => void) => {
  animate(el as HTMLElement, { opacity: 0, x: -20 }, { duration: 0.3, easing: 'ease-out' }).finished.then(done);
};

const onMenuEnter = (el: Element, done: () => void) => {
  animate(el as HTMLElement, { opacity: [0, 1], scale: [0.9, 1], y: [10, 0] }, { duration: 0.3, easing: [0.34, 1.56, 0.64, 1] }).finished.then(done);
};

const onMenuLeave = (el: Element, done: () => void) => {
  animate(el as HTMLElement, { opacity: 0, scale: 0.95, y: -5 }, { duration: 0.2, easing: 'ease-in' }).finished.then(done);
};

// Animation sequence callbacks
const onHighlightComplete = () => {
  if (step.value === 'highlighting') {
    const timer = setTimeout(() => {
      step.value = 'menu';
      const clickTimer = setTimeout(() => {
        step.value = 'clicking';
      }, TIMING.clickingDelay);
      animationTimers.push(clickTimer);
    }, TIMING.menuDelay);
    animationTimers.push(timer);
  }
};

const onAddedToMaterial = () => {
  if (step.value === 'clicking') {
    const timer = setTimeout(() => {
      step.value = 'list';
      const generateTimer = setTimeout(() => {
        step.value = 'clicking-generate';
        // Transition to generating after pulse animation
        const generatingTimer = setTimeout(() => {
          step.value = 'generating';
          const convertTimer = setTimeout(() => {
            step.value = 'converted';
            // Loop: reset after showing success
            const resetTimer = setTimeout(() => {
              resetAnimation();
            }, TIMING.converted);
            animationTimers.push(resetTimer);
          }, TIMING.generating);
          animationTimers.push(convertTimer);
        }, 600); // Match the pulse animation duration
        animationTimers.push(generatingTimer);
      }, TIMING.generateDelay);
      animationTimers.push(generateTimer);
    }, TIMING.listDelay);
    animationTimers.push(timer);
  }
};

const resetAnimation = () => {
  // Clear any pending timers
  isTransitioning = false;
  animationTimers.forEach(timer => clearTimeout(timer));
  animationTimers = [];

  // Reset to beginning
  const timer = setTimeout(() => {
    step.value = 'typing';
    startAnimation();
  }, TIMING.resetDelay);
  animationTimers.push(timer);
};

const startAnimation = () => {
  const timer = setTimeout(() => {
    step.value = 'highlighting';
  }, TIMING.typing);
  animationTimers.push(timer);
};

onMounted(() => {
  startAnimation();
});

onUnmounted(() => {
  // Cleanup all timers
  animationTimers.forEach(timer => clearTimeout(timer));
  animationTimers = [];
});
</script>

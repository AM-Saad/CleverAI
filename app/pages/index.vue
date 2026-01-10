<template>
  <div class="overflow-auto h-full" ref="scrollContainer">
    <header
      class="md:h-screen rounded-2xl py-2 flex flex-col lg:flex-row w-full  relative max-w-7xl mx-auto gap-8 md:gap-12 lg:gap-24 px-4 md:px-8 lg:px-12 overflow-hidden">
      <div class="flex flex-col gap-2 relative z-20">
        <!-- 
        <motion.h1 :initial="{ opacity: 0, scale: 0.9 }" :animate="{ opacity: 1, scale: 1 }" :transition="{
          duration: 1.9,
          scale: {
            type: 'spring',
            visualDuration: 0.9,
            bounce: 0.1,
          },
        }" class="text-9xl font-black tracking-tighter text-primary">
          Cognilo
        </motion.h1> -->
        <motion.h1
          class="text-4xl! md:text-5xl! lg:text-6xl! xl:text-7xl! text-dark! dark:text-light! font-light text-wrap"
          :initial="{ opacity: 0, y: 20 }" :animate="{ opacity: 1, y: 0 }" :transition="{
            duration: 1.5,
            delay: 1.5,
          }">
          Turn Notes Into Knowledge That Sticks empowered by <span class="header-brand-name-gradient">Cognilo</span>
        </motion.h1>

        <motion.div class="flex gap-4 mt-6" :initial="{ opacity: 0, y: 20 }" :animate="{ opacity: 1, y: 0 }"
          :transition="{
            duration: 1.5,
            delay: 1.7,
          }">
          <router-link to="/auth/signup">
            <UButton size="lg">Try for free</UButton>
          </router-link>
        </motion.div>

      </div>
      <div class="relative h-full flex items-start md:items-center">
        <!-- Lottie Animation -->
        <motion.div :initial="{ scale: 10 }" :animate="{ scale: 1 }" :transition="{
          duration: 1,
          delay: 0.4,
        }">
          <landing-lottie-animation :animation-data="aiLogoAnimation" :loop="true" :autoplay="true"
            class="mb-4 z-10 " />
        </motion.div>
        <motion.div class="relative z-20" :initial="{ opacity: 0, y: 20 }" :animate="{ opacity: 1, y: 0 }" :transition="{
          duration: 1.5,
          delay: 2,
        }">

          <span class="block my-xl font-light text-sm text-dark dark:text-light">About</span>
          <p class="font-extralight leading-7 text-dark dark:text-light lg:w-4/5">
            Cognilo is a cutting-edge AI-powered spaced repetition learning platform designed to dramatically improve
            long-term retention and make learning fast, smart, and intuitive
          </p>
          <div class="flex items-center gap-1 place-self-end my-xl">
            <span class="font-light text-sm text-dark dark:text-light">Watch us</span>
            <div
              class="w-10 h-10 rounded-full border dark:border-light flex items-center justify-center hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer">
              <u-icon name="mdi:play" class="m-auto dark:text-light" />
            </div>
            <!-- <ui-watch-video /> -->
          </div>
        </motion.div>

      </div>
    </header>
    <div class="relative overflow-hidden py-12">
      <landing-friction-section />
      <section class="relative z-10">
        <LandingTextGenerateEffect class="text-3xl text-center font-bold my-4 text-dark dark:text-light"
          :words="'Capture ideas. Learn them. Retain forever.'" />
        <landing-hero-animation />
      </section>
      <motion.div :initial="{ opacity: 0, scale: 0 }"
        :animate="hasScrolledHalfViewport ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0 }" :transition="{
          duration: .7,
          delay: 0.1,
        }"
        class="absolute top-0 left-1/2 transform -translate-x-1/2 w-[150%] h-[150%] z-0 bg-gray-200  dark:bg-muted rounded-full">

      </motion.div>
    </div>


    <section
      class="rounded-2xl py-2 w-full block relative z-10 max-w-7xl mx-auto gap-8 md:gap-12 lg:gap-24  md:px-8 lg:px-12">
      <landing-features />
    </section>
    <landing-scroll-reveal class="my-20" text="Learn smarter. Retain longer. Achieve more with Cognilo." />

    <!-- <landing-expandable-gallery class="max-w-7xl mx-auto my-20 px-4 md:px-8 lg:px-12" :images="[
      '/images/home/gallery-1.png',
      '/images/home/gallery-2.png',
      '/images/home/gallery-3.png',
      '/images/home/gallery-4.png',
      '/images/home/gallery-5.png',
    ]" /> -->
    <section id="cta" class="w-full relative py-24 md:py-32 lg:py-48 overflow-hidden">
      <!-- Background Gradients -->
      <div class="absolute inset-0 z-0 opacity-30 dark:opacity-20 pointer-events-none">
        <div class="absolute top-0 left-1/4 w-96 h-96 bg-primary/20 rounded-full blur-3xl -translate-y-1/2"></div>
        <div class="absolute bottom-0 right-1/4 w-96 h-96 bg-blue-500/20 rounded-full blur-3xl translate-y-1/2"></div>
      </div>

      <div class="container relative z-10 mx-auto px-4 md:px-6">
        <blur-reveal :delay="0.2" class="mx-auto max-w-4xl space-y-8 text-center">
          <h2
            class="font-headline text-5xl font-black tracking-tighter sm:text-6xl md:text-7xl bg-clip-text text-transparent bg-gradient-to-br from-dark via-slate-700 to-slate-500 dark:from-white dark:via-gray-200 dark:to-gray-500 pb-2">
            Ready to close the loop?
          </h2>
          <p class="text-xl text-muted-foreground md:text-2xl font-light max-w-2xl mx-auto leading-relaxed">
            Start free. Upgrade only if it helps you learn faster. <br class="hidden sm:block" />No credit card
            required.
          </p>
          <div class="flex justify-center pt-8">
            <u-button size="xl"
              class="group px-8 py-4 relative overflow-hidden transition-all hover:scale-105 hover:shadow-xl hover:shadow-primary/20">
              <router-link to="/auth/signup" class="flex items-center gap-3 text-lg">
                Start Your First Loop
                <u-icon name="heroicons:arrow-right-20-solid"
                  class="w-6 h-6 transition-transform group-hover:translate-x-1" />
              </router-link>
            </u-button>
          </div>
        </blur-reveal>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { motion } from "motion-v";
import { useScroll, useWindowSize } from "@vueuse/core";
import aiLogoAnimationData from '~/assets/AI logo Foriday.json';

console.log("🏠 [INDEX.VUE] Page script setup initializing...");

const aiLogoAnimation = aiLogoAnimationData;

const scrollContainer = ref<HTMLElement | null>(null);
const { y } = useScroll(scrollContainer);
const { height } = useWindowSize();

const hasScrolledHalfViewport = computed(() => {
  return y.value > height.value * 0.1;
});

const baseUrl = useRuntimeConfig().public.APP_BASE_URL as string;
definePageMeta({
  auth: { unauthenticatedOnly: true, navigateAuthenticatedTo: "/folders" },

  title: "AI-Powered Spaced Repetition Learning Platform | Cognilo",
});


useHead({
  meta: [
    {
      name: "description",
      content:
        "Cognilo is an AI-powered spaced repetition learning platform offering adaptive flashcards, AI chat, and personalized study workflows to improve long-term memory retention.",
    },
    {
      property: "og:title",
      content: "AI-Powered Spaced Repetition Learning Platform | Cognilo",
    },
    {
      property: "og:description",
      content:
        "Learn smarter with Cognilo — an AI-powered spaced repetition platform for flashcards, quizzes, and adaptive study workflows.",
    },
    {
      property: "og:type",
      content: "website",
    },
    {
      property: "og:url",
      content: baseUrl,
    },
    {
      property: "og:image",
      content: `${baseUrl}/images/og/main.png`,
    },
    {
      name: "twitter:card",
      content: "summary_large_image",
    },
    {
      name: "twitter:title",
      content: "AI-Powered Spaced Repetition Learning Platform | Cognilo",
    },
    {
      name: "twitter:description",
      content:
        "Cognilo helps you retain knowledge faster using AI-powered spaced repetition, flashcards, and adaptive learning.",
    },
    {
      name: "twitter:image",
      content: `${baseUrl}/images/og/main.png`,
    },
  ],
  script: [
    {
      type: "application/ld+json",
      innerHTML: JSON.stringify({
        "@context": "https://schema.org",
        "@type": "SoftwareApplication",
        name: "Cognilo",
        applicationCategory: "EducationalApplication",
        operatingSystem: "Web",
        description:
          "AI-powered spaced repetition learning platform with adaptive flashcards, quizzes, and AI-assisted study workflows.",
        offers: {
          "@type": "Offer",
          price: "0",
          priceCurrency: "USD",
        },
      }),
    },
  ],
});

console.log("🏠 [INDEX.VUE] Page meta defined");

// If you want to use it in setup, import from the nuxtApp.
// const { $pwa } = useNuxtApp()

async function registerPeriodicSync(): Promise<void> {
  console.log("🏠 [INDEX.VUE] registerPeriodicSync called");
  const registration = await navigator.serviceWorker.ready;

  if ("periodicSync" in registration) {
    try {
      await registration.periodicSync.register("contentSync", {
        //   minInterval: 24 * 60 * 60 * 1000, // Sync every 24 hours
        minInterval: 3,
      });
      console.log("Periodic sync registered for content updates.");
    } catch (error) {
      console.error("Periodic Sync registration failed:", error);
    }
  } else {
    console.log("Periodic Sync is not supported.");
  }
}

onBeforeMount(() => {
  console.log("🏠 [INDEX.VUE] onBeforeMount triggered");
});

onMounted(() => {
  //   if ($pwa.offlineReady) console.log("App is offline ready")
  //   else console.log("App is not offline ready")
  //   registerPeriodicSync()
  console.log("🏠 [INDEX.VUE] onMounted triggered - Page mounted successfully");
});

console.log("🏠 [INDEX.VUE] Page script setup completed");
</script>

<style scoped>
body {
  background-color: #fff !important;
}
</style>
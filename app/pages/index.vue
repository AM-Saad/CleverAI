<template>
  <div class="overflow-auto">
    <header
      class="h-[calc(100vh-140px)] rounded-2xl py-2 flex flex-col lg:flex-row w-full  relative max-w-7xl mx-auto gap-8 md:gap-12 lg:gap-24 px-4 md:px-8 lg:px-12">
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
        <ui-paragraph
          class="text-4xl! md:text-5xl! lg:text-6xl! xl:text-7xl! text-dark! dark:text-light! font-light text-wrap">
          Turn Notes Into Knowledge That Sticks empowered by <span class="header-brand-name-gradient">Cognilo</span>
        </ui-paragraph>

        <div class="flex gap-4 mt-6">
          <router-link to="/auth/signup">
            <UButton size="lg">Try for free</UButton>
          </router-link>
        </div>

      </div>
      <div class="relative h-full flex items-start md:items-center">
        <!-- Lottie Animation -->
        <ui-lottie-animation :animation-data="aiLogoAnimation" :loop="true" :autoplay="true" class="mb-4 z-10 " />
        <div class="relative z-20">

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
        </div>

      </div>
    </header>
    <section>
      <UiTextGenerateEffect class="text-3xl text-center font-medium my-4 text-dark dark:text-light"
        :words="'Capture ideas. Learn them. Retain forever.'" />
      <ui-hero-animation />
    </section>

    <!-- <div class="wrapper">
      <section class="brands my-xl flex flex-wrap justify-between gap-3">
        <div class="text-balance flex justify-center">
          <h1 class="text-balance text-center text-2xl font-bold dark:text-light">
            Flashcards, Chatbot, and custom quizzes — all tailored to
            <UiTextHighlight class="rounded-lg bg-gradient-to-r from-purple-300 to-orange-300">
              make learning fun and effective
            </UiTextHighlight>
          </h1>
        </div>
      </section>
    </div> -->
  </div class="overflow-auto">
</template>

<script setup lang="ts">
import { motion } from "motion-v";
import aiLogoAnimationData from '~/assets/AI logo Foriday.json';

console.log("🏠 [INDEX.VUE] Page script setup initializing...");

const aiLogoAnimation = aiLogoAnimationData;

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

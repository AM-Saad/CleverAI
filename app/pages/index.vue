<template>
  <div>
    <section class="my-xl flex w-full">
      <div class="flex flex-col gap-2">
        <motion.h2 :initial="{ opacity: 0, scale: 0.9 }" :animate="{ opacity: 1, scale: 1 }" :transition="{
          duration: 1.9,
          scale: {
            type: 'spring',
            visualDuration: 0.9,
            bounce: 0.1,
          },
        }" class="text-9xl font-light tracking-tighter text-primary">
          Clever AI
        </motion.h2>
        <UiTextGenerateEffect class="text-4xl font-medium my-4 dark:text-light"
          :words="'AI, Chatbot, Assistant, Helper, Support, Guide'" />

        <router-link to="/auth/signup">
          <UButton>Start Now</UButton>
        </router-link>
      </div>
    </section>
    <div class="wrapper">
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
    </div>
  </div>
</template>

<script setup lang="ts">
import { motion } from "motion-v";

console.log("🏠 [INDEX.VUE] Page script setup initializing...");

const baseUrl = useRuntimeConfig().public.APP_BASE_URL as string;
console.log("🏠 [INDEX.VUE] Base URL:", baseUrl);
definePageMeta({
  auth: false,
  title: "AI-Powered Spaced Repetition Learning Platform | CleverAI",
});

useHead({
  meta: [
    {
      name: "description",
      content:
        "CleverAI is an AI-powered spaced repetition learning platform offering adaptive flashcards, AI chat, and personalized study workflows to improve long-term memory retention.",
    },
    {
      property: "og:title",
      content: "AI-Powered Spaced Repetition Learning Platform | CleverAI",
    },
    {
      property: "og:description",
      content:
        "Learn smarter with CleverAI — an AI-powered spaced repetition platform for flashcards, quizzes, and adaptive study workflows.",
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
      content: `${baseUrl}/images/og/recwide.png`,
    },
    {
      name: "twitter:card",
      content: "summary_large_image",
    },
    {
      name: "twitter:title",
      content: "AI-Powered Spaced Repetition Learning Platform | CleverAI",
    },
    {
      name: "twitter:description",
      content:
        "CleverAI helps you retain knowledge faster using AI-powered spaced repetition, flashcards, and adaptive learning.",
    },
    {
      name: "twitter:image",
      content: `${baseUrl}/images/og/recwide.png`,
    },
  ],
  script: [
    {
      type: "application/ld+json",
      innerHTML: JSON.stringify({
        "@context": "https://schema.org",
        "@type": "SoftwareApplication",
        name: "CleverAI",
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
  console.log("🏠 [INDEX.VUE] Document body:", document.body);
});

console.log("🏠 [INDEX.VUE] Page script setup completed");
</script>

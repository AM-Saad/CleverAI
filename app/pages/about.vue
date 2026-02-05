<template>
  <shared-page-wrapper>
    <div class="wrapper max-w-5xl mx-auto space-y-24 py-12">

      <!-- Hero / Introduction -->
      <section id="about" class="min-h-[40vh] flex flex-col justify-center">
        <blur-reveal :delay="0.2" class="space-y-8">
          <ui-title size="5xl" tag="h1"
            class="leading-tight bg-clip-text text-transparent bg-gradient-to-r from-primary to-slate-600 ">
            Cognilo — AI‑Powered Spaced Repetition Learning Platform
          </ui-title>

          <ui-paragraph size="lg" color="onsurface" class="leading-relaxed max-w-3xl">
            Cognilo is a cutting-edge AI-powered spaced repetition learning platform designed to dramatically improve
            long-term retention and make learning fast, smart, and intuitive.
          </ui-paragraph>

          <ui-paragraph size="base" color="onsurface" class="max-w-3xl">
            We’re building more than just another flashcard app — we’re building an intelligent learning ecosystem that
            combines spaced repetition algorithms, adaptive learning, mobile-friendly progressive web app (PWA)
            technology, and a scalable offline-first study experience that works anywhere.
          </ui-paragraph>
        </blur-reveal>
      </section>

      <!-- Why Choose Us -->
      <section id="why-choose-us">
        <div class="mb-10 text-center md:text-left">
          <ui-subtitle tag="h2" size="2xl" weight="bold" class="mb-4">
            Why Choose Cognilo
          </ui-subtitle>
          <ui-paragraph size="lg" color="onbackground" class="max-w-2xl">
            At Cognilo, we help learners retain more in less time by blending proven cognitive science with the latest
            web technologies.
          </ui-paragraph>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
          <ui-card v-for="(item, idx) in whyChooseItems" :key="idx" hover="lift" shadow="sm" variant="default">
            <div class="p-6 space-y-3">
              <ui-subtitle>{{ item.title }}</ui-subtitle>
              <ui-paragraph size="sm" color="onsurface" class="text-wrap">
                {{ item.description }}
              </ui-paragraph>
            </div>
          </ui-card>
        </div>
      </section>

      <!-- How it Works & Core Features Grid -->
      <div class="grid md:grid-cols-2 gap-16">
        <section id="why-it-works">
          <ui-subtitle tag="h2" size="2xl" weight="bold" class="mb-6">
            Scientific Retention
          </ui-subtitle>
          <ui-paragraph class="mb-8" size="base" color="onsurface">
            Unlike traditional study tools that rely on random repetition, Cognilo uses data-driven algorithms to boost
            memory retention by intelligently spacing study sessions.
          </ui-paragraph>

          <div class="space-y-4">
            <div v-for="(item, idx) in algorithmBenefits" :key="idx" class="flex items-start gap-4">
              <div class="mt-1 w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <div class="w-2 h-2 rounded-full bg-primary"></div>
              </div>
              <div>
                <ui-subtitle>{{ item.title }}</ui-subtitle>
                <ui-paragraph size="sm" color="onsurface">{{ item.description }}</ui-paragraph>
              </div>
            </div>
          </div>
        </section>

        <section id="core-features">
          <ui-subtitle tag="h2" size="2xl" weight="bold" class="mb-6">
            Core Features
          </ui-subtitle>
          <ui-paragraph class="mb-8" size="base" color="onsurface">
            Everything you need for an efficient study workflow, from content creation to review.
          </ui-paragraph>

          <div class="space-y-6">
            <ui-card v-for="(item, idx) in coreFeatures" :key="idx" variant="default">
              <div class="p-4">
                <ui-subtitle>{{ item.title }}</ui-subtitle>
                <ui-paragraph size="sm" color="onsurface" class="text-wrap">{{ item.description }}</ui-paragraph>
              </div>
            </ui-card>
          </div>
        </section>
      </div>

      <!-- Who It's For -->
      <section id="who-it-s-for"
        class="bg-neutral-100 dark:bg-neutral-900 rounded-3xl p-8 md:p-12 relative overflow-hidden">
        <div class="relative z-10">
          <ui-subtitle tag="h2" size="3xl" weight="bold" class="mb-8 text-center">
            Built for Every Learner
          </ui-subtitle>

          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div v-for="(person, idx) in targetAudience" :key="idx"
              class="text-center p-4 rounded-xl bg-white dark:bg-neutral-800 shadow-sm">
              <span class="text-lg font-medium text-dark dark:text-light">{{ person }}</span>
            </div>
          </div>

          <ui-paragraph class="mt-10 text-center max-w-2xl mx-auto" size="base" color="onsurface">
            Cognilo adapts to how you learn — not the other way around. Focus on learning, not memorization.
          </ui-paragraph>
        </div>
      </section>

    </div>
  </shared-page-wrapper>
</template>

<script setup lang="ts">
import BlurReveal from '~/components/ui/blur-reveal/BlurReveal.vue';

const baseUrl = useRuntimeConfig().public.APP_BASE_URL as string;
console.log("🏠 [INDEX.VUE] Base URL:", baseUrl);
definePageMeta({
  auth: false,
})

const whyChooseItems = [
  {
    title: "Spaced repetition learning software",
    description: "Schedules reviews at scientifically optimal intervals so users actually remember what they study."
  },
  {
    title: "Adaptive flashcards and study pathways",
    description: "Personalizes each user’s experience based on performance and progress."
  },
  {
    title: "AI-driven content generation",
    description: "Powered by our multi-LLM gateway that delivers contextual learning support and insights on demand."
  },
  {
    title: "Progressive Web App (PWA)",
    description: "Offline support, push notifications, and seamless cross-device sync — so learning stays fast, smooth, and always available."
  }
];

const algorithmBenefits = [
  {
    title: "Boost memory retention",
    description: "Intelligently spacing study sessions."
  },
  {
    title: "Maximize long-term recall",
    description: "With personalized review schedules."
  },
  {
    title: "Study offline and online",
    description: "Consistent performance across devices."
  }
];

const targetAudience = [
  "Student preparing for exams",
  "Professional learning new skills",
  "Language learner mastering vocabulary",
  "Lifelong learner with big goals"
];

const coreFeatures = [
  {
    title: "AI-Enhanced Study Experience",
    description: "Personalized guidance, topic expansions, and instant answers to questions while you study."
  },
  {
    title: "Offline-capable Web App (PWA)",
    description: "Lightning-fast performance, push reminders, and sync that doesn’t lock you into an app store ecosystem."
  },
  {
    title: "Spaced Repetition Flashcards",
    description: "Algorithms that show content at the right time — just as you’re about to forget."
  }
];

useHead({
  meta: [
    {
      name: "description",
      content:
        "Discover Cognilo — the AI-powered spaced repetition learning platform for adaptive study, smart flashcards, offline learning, and better long-term retention. Learn smarter, anywhere.",
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
          "AI-powered spaced repetition software for adaptive learning, smart flashcards, and long-term memory retention.",
        offers: {
          "@type": "Offer",
          price: "0",
          priceCurrency: "USD",
        },
      }),
    },
  ],
});
</script>

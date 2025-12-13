<template>
  <shared-page-wrapper>
    <div class="wrapper">
      <section id="about">
        <ui-title class="mb-5" size="3xl" tag="h1">
          CleverAI — AI‑Powered Spaced Repetition Learning Platform
        </ui-title>
        <ui-paragraph size="base" color="neutral">
          CleverAI is a cutting-edge AI-powered spaced repetition learning platform designed to dramatically improve
          long-term retention and make learning fast, smart, and intuitive.

          We’re building more than just another flashcard app — we’re building an intelligent learning ecosystem that
          combines spaced repetition algorithms, adaptive learning, mobile-friendly progressive web app (PWA)
          technology, and a scalable offline-first study experience that works anywhere — even without internet access
        </ui-paragraph>
      </section>

      <section id="why-choose-us" class="mt-10">
        <ui-subtitle tag="h2" size="2xl" weight="bold">
          Why Choose CleverAI for Spaced Repetition Learning
        </ui-subtitle>
        <ui-paragraph class="mb-5" size="base" color="neutral">
          At CleverAI, we help learners retain more in less time by blending proven cognitive science with the latest
          web technologies:
        </ui-paragraph>
        <ul class="list-disc list-inside mb-5 space-y-2">
          <ui-paragraph size="sm" color="muted" tag="li">
            <strong>Spaced repetition learning software:</strong> that schedules reviews at scientifically optimal
            intervals so users actually remember what they study.
          </ui-paragraph>

          <ui-paragraph size="sm" color="muted" tag="li">
            <strong>Adaptive flashcards and study pathways:</strong> that personalize each user’s experience based on
            performance and progress.
          </ui-paragraph>

          <ui-paragraph size="sm" color="muted" tag="li">
            <strong>AI-driven content generation and explanations:</strong> powered by our multi-LLM gateway that
            delivers contextual learning support and insights on demand.
          </ui-paragraph>

          <ui-paragraph size="sm" color="muted" tag="li">
            <strong>Progressive Web App (PWA) with offline support,</strong> push notifications, and seamless
            cross-device sync — so learning stays fast, smooth, and always available.
          </ui-paragraph>
        </ul>
      </section>
      <section id="why-it-works" class="mt-10">
        <ui-subtitle tag="h2" size="2xl" weight="bold">
          How Our Spaced Repetition Algorithm Improves Memory Retention
        </ui-subtitle>
        <ui-paragraph class="mb-5" size="base" color="neutral">
          Unlike traditional study tools that rely on random repetition, CleverAI uses data-driven spaced repetition
          algorithms — the same principles behind top spaced repetition tools — to help users:
        </ui-paragraph>
        <ul class="list-disc list-inside mb-5 space-y-2">

          <ui-paragraph size="sm" color="muted" tag="li">
            <strong>Boost memory retention</strong> by intelligently spacing study sessions.
          </ui-paragraph>

          <ui-paragraph size="sm" color="muted" tag="li">
            <strong>Maximize long-term recall</strong> with personalized review schedules.
          </ui-paragraph>

          <ui-paragraph size="sm" color="muted" tag="li">
            <strong>Study offline and online,</strong> with consistent performance across devices.
          </ui-paragraph>
        </ul>
      </section>
      <section id="who-it-s-for" class="mt-10">
        <ui-subtitle tag="h2" size="2xl" weight="bold">
          Who This AI Learning Platform Is Built For
        </ui-subtitle>
        <ui-paragraph class="mb-5" size="base" color="neutral">
          Whether you’re a:
        </ui-paragraph>
        <ul class="list-disc list-inside mb-5 space-y-2">

          <ui-paragraph size="sm" color="muted" tag="li">
            student preparing for exams,
          </ui-paragraph>

          <ui-paragraph size="sm" color="muted" tag="li">
            professional learning new skills,
          </ui-paragraph>
          <ui-paragraph size="sm" color="muted" tag="li">
            language learner mastering vocabulary,
          </ui-paragraph>
          <ui-paragraph size="sm" color="muted" tag="li">
            or lifelong learner with big goals,
          </ui-paragraph>
        </ul>
        <ui-paragraph class="mb-5" size="base" color="neutral">
          CleverAI adapts to how you learn — not the other way around. Our platform supports fast flashcards,
          intelligent review scheduling, and deep insights into your progress so you can focus on learning, not
          memorization.
        </ui-paragraph>
      </section>

      <section id="core-features" class="mt-10">
        <ui-subtitle tag="h2" size="2xl" weight="bold">
          Core Features of Our AI‑Powered Learning Platform
        </ui-subtitle>
        <ul class="list-disc list-inside mb-5 space-y-2">
          <ui-paragraph size="sm" color="muted" tag="li">
            <strong>AI-Enhanced Study Experience:</strong> Personalized guidance, topic expansions, and instant
            answers to questions while you study.
          </ui-paragraph>

          <ui-paragraph size="sm" color="muted" tag="li">
            <strong>Offline-capable Web App (PWA):</strong> Lightning-fast performance, push reminders, and sync that
            doesn’t lock you into an app store ecosystem.
          </ui-paragraph>

          <ui-paragraph size="sm" color="muted" tag="li">
            <strong>Spaced Repetition Flashcards:</strong> Algorithms that show content at the right time — just as
            you’re about to forget.
          </ui-paragraph>
        </ul>
      </section>

    </div>
  </shared-page-wrapper>
</template>

<script setup lang="ts">
const baseUrl = useRuntimeConfig().public.APP_BASE_URL as string;
console.log("🏠 [INDEX.VUE] Base URL:", baseUrl);
definePageMeta({
  auth: false,
})
useHead({
  meta: [
    {
      name: "description",
      content:
        "Discover CleverAI — the AI-powered spaced repetition learning platform for adaptive study, smart flashcards, offline learning, and better long-term retention. Learn smarter, anywhere.",
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

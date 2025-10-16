<template>
    <div>
        <Title>Shater AI | Your AI Companion</Title>

        <section class="my-xl flex w-full">
            <div class="flex flex-col gap-2">
                <motion.h2 :initial="{ opacity: 0, scale: .9 }" :animate="{ opacity: 1, scale: 1 }" :transition="{
                    duration: 1.9,
                    scale: {
                        type: 'spring',
                        visualDuration: 0.9,
                        bounce: 0.1
                    }
                }" class="text-9xl font-light tracking-tighter text-primary ">
                    Shater AI
                </motion.h2>
                <UiTextGenerateEffect class="text-4xl font-medium my-4"
                    :words="'AI, Chatbot, Assistant, Helper, Support, Guide'" />
                <router-link to="/auth/signup">
                    <UButton>Start Now</UButton>
                </router-link>

            </div>
        </section>
        <div class="wrapper">
            <section class="brands my-xl flex flex-wrap justify-between gap-3">
                <div class="text-balance flex justify-center">
                    <h1 class="text-balance text-center text-2xl font-bold">
                        Flashcards, Chatbot, and custom quizzes — all tailored
                        to
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
import { motion } from 'motion-v'

console.log('🏠 [INDEX.VUE] Page script setup initializing...');

definePageMeta({
    title: "Recwide - Free Screen Recorder",
    description:
        "Screen recorder has never been this easy, free and timeless before",
    image: "/images/og/recwide.png",
    auth: false,
})

console.log('🏠 [INDEX.VUE] Page meta defined');

// If you want to use it in setup, import from the nuxtApp.
// const { $pwa } = useNuxtApp()

async function registerPeriodicSync(): Promise<void> {
    console.log('🏠 [INDEX.VUE] registerPeriodicSync called');
    const registration = await navigator.serviceWorker.ready

    if ("periodicSync" in registration) {
        try {
            await registration.periodicSync.register("contentSync", {
                //   minInterval: 24 * 60 * 60 * 1000, // Sync every 24 hours
                minInterval: 3,
            })
            console.log("Periodic sync registered for content updates.")
        } catch (error) {
            console.error("Periodic Sync registration failed:", error)
        }
    } else {
        console.log("Periodic Sync is not supported.")
    }
}

onBeforeMount(() => {
    console.log('🏠 [INDEX.VUE] onBeforeMount triggered');
});

onMounted(() => {
    //   if ($pwa.offlineReady) console.log("App is offline ready")
    //   else console.log("App is not offline ready")
    //   registerPeriodicSync()
    console.log("🏠 [INDEX.VUE] onMounted triggered - Page mounted successfully")
    console.log("🏠 [INDEX.VUE] Document body:", document.body);
})

console.log('🏠 [INDEX.VUE] Page script setup completed');
</script>

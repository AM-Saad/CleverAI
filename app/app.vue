<template>
    <div>
        <Html lang="en" />
        <Title>ShaterAI | Your AI-powered Learning Assistant</Title>
        <Meta lang="en" name="description"
            content="ShaterAI is your AI-powered learning assistant, designed to help you learn more effectively and efficiently."
            theme-color="#f3f4f6" />
        <Link rel="manifest" href="/manifest.webmanifest" />
        <NuxtErrorBoundary @error="ErrorLogger">
            <VitePwaManifest />

            <NuxtLoadingIndicator :duration="4000" :color="'#fe9548'" />
            <UApp>

                <NuxtLayout>
                    <NuxtPage />
                </NuxtLayout>

                <!-- Dev-only Service Worker debug panel -->
                <ClientOnly>
                    <ServiceWorkerBridgePanel v-if="isDev" />
                </ClientOnly>
            </UApp>
        </NuxtErrorBoundary>
    </div>
</template>

<script setup lang="ts">
import { useRouter } from 'vue-router'


const router = useRouter();
const ErrorLogger = (): void => {
    router.replace({
        name: 'error'
    });
}

// Render dev tools only in development builds
const isDev = import.meta.dev;


</script>

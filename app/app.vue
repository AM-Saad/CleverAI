<template>
    <div>
        <Html lang="en" />
        <Title>ShaterAI | Your AI-powered Learning Assistant</Title>
        <Meta lang="en" name="description"
            content="ShaterAI is your AI-powered learning assistant, designed to help you learn more effectively and efficiently."
            theme-color="#f3f4f6" />
        <Link rel="manifest" href="/manifest.webmanifest" />
        <NuxtErrorBoundary @error="ErrorLogger">

            <NuxtLoadingIndicator :duration="4000" :color="'#fe9548'" />
            <UApp>

                <NuxtLayout>
                    <NuxtPage />
                </NuxtLayout>

            </UApp>
        </NuxtErrorBoundary>
    </div>
</template>

<script setup lang="ts">
import { useRouter } from 'vue-router'
import { onBeforeMount, onMounted, onErrorCaptured } from 'vue'

const router = useRouter();
console.log('🚀 [APP.VUE] Router initialized:', router);

const ErrorLogger = (): void => {
    console.error('🚨 [APP.VUE] Error logged, redirecting to error page');
    router.replace({
        name: 'error'
    });
}




onErrorCaptured((err, instance, info) => {
    console.error('🚨 [APP.VUE] Error captured:', err, instance, info);
    return false; // Let error propagate
});

</script>

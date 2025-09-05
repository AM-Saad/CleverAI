<template>
    <div>
        <Html lang="en" />
        <Title>ShaterAI | Your AI-powered Learning Assistant</Title>
        <Meta
lang="en" name="description"
            content="ShaterAI is your AI-powered learning assistant, designed to help you learn more effectively and efficiently."
            theme-color="#f3f4f6" />
        <NuxtErrorBoundary @error="ErrorLogger">
            <VitePwaManifest />

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


const router = useRouter();
const ErrorLogger = (): void => {
    router.replace({
        name: 'error'
    });
}


</script>

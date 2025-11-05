<template>
    <div>
        <Html lang="en" />
        <Title>CleverAI | Your AI-powered Learning Assistant</Title>
        <Meta lang="en" name="description"
            content="CleverAI is your AI-powered learning assistant, designed to help you learn more effectively and efficiently."
            theme-color="#f3f4f6" />
        <Link rel="manifest" href="/manifest.webmanifest" />
        <NuxtErrorBoundary @error="ErrorLogger">

            <NuxtLoadingIndicator :color="'#fe9548'" :duration="10000" :throttle="6000" :reset-delay="5000" />
            <UApp>

                <NuxtLayout>

                    <NuxtPage />
                </NuxtLayout>

                <!-- Development Testing Dashboard -->
                <LazyDebugTestingDashboard />

                <!-- Notification Subscription Modal -->
                <ClientOnly>
                    <Teleport to="body">
                        <ModalsNotificationSubscriptionModal :show="showNotificationModal"
                            @close="handleNotificationModalClose" @subscribed="handleNotificationSubscribed"
                            @dismissed="handleNotificationDismissed" />
                    </Teleport>
                </ClientOnly>

            </UApp>
        </NuxtErrorBoundary>
    </div>
</template>

<script setup lang="ts">
import { useRouter } from 'vue-router'
import { onErrorCaptured } from 'vue'
const { isLoading: isIndicatorLoading } = useLoadingIndicator({
    duration: 10000,
    throttle: 2000,
    // This is how progress is calculated by default
    // estimatedProgress: (duration, elapsed) => (2 / Math.PI * 100) * Math.atan(elapsed / duration * 100 / 50),
})
// same as set(0, { force: true })
// set the progress to 0, and show loading immediately
// start({ force: true })
const router = useRouter()
console.log('🚀 [APP.VUE] Router initialized:', router)

// Notification modal state
const showNotificationModal = ref(false)

const toaster = { position: 'bottom-center', max:3 }

const ErrorLogger = (): void => {
    console.error('🚨 [APP.VUE] Error logged, redirecting to error page')
    router.replace({
        name: 'error'
    })
}

// Notification modal handlers
const handleNotificationModalClose = () => {
    showNotificationModal.value = false
}

const handleNotificationSubscribed = () => {
    showNotificationModal.value = false
    console.log('✅ User subscribed to notifications from app.vue')
}

const handleNotificationDismissed = () => {
    showNotificationModal.value = false
    console.log('📋 User dismissed notification prompt from app.vue')
}

// Expose method to show modal globally
provide('showNotificationModal', () => {
    showNotificationModal.value = true
})

// Listen for custom event from plugin
onMounted(() => {
    if (import.meta.client) {
        window.addEventListener('showNotificationModal', () => {
            showNotificationModal.value = true
        })
    }
})

onBeforeUnmount(() => {
    if (import.meta.client) {
        window.removeEventListener('showNotificationModal', () => {
            showNotificationModal.value = true
        })
    }
})

onErrorCaptured((err, instance, info) => {
    console.error('🚨 [APP.VUE] Error captured:', err, instance, info)
    return false // Let error propagate
})
</script>

<template>
    <div>
        <Html lang="en" />
        <Link rel="manifest" href="/manifest.webmanifest" />
        <NuxtErrorBoundary @error="ErrorLogger">

            <NuxtLoadingIndicator :color="'#fe9548'" :duration="10000" :throttle="6000" :reset-delay="5000" />
            <UApp>

                <NuxtLayout>

                    <NuxtPage />
                </NuxtLayout>

                <!-- Development Testing Dashboard -->
                <!-- <LazyDebugTestingDashboard /> -->

                <!-- Notification Subscription Modal -->
                <ClientOnly>
                    <Teleport to="body">
                        <ModalsNotificationSubscriptionModal :show="showNotificationModal"
                            @close="handleNotificationModalClose" @subscribed="handleNotificationSubscribed"
                            @dismissed="handleNotificationDismissed" />
                    </Teleport>
                </ClientOnly>

                <!-- AI Model Download Toast -->
                <ClientOnly>
                    <ai-model-download-toast />
                </ClientOnly>

            </UApp>
        </NuxtErrorBoundary>
    </div>
</template>

<script setup lang="ts">
import { useRouter } from 'vue-router'
import { onErrorCaptured } from 'vue'

type WindowControlsOverlay = {
    addEventListener: (type: 'geometrychange', listener: () => void) => void
    getTitlebarAreaRect: () => { width: number }
}

type NavigatorWithWindowControlsOverlay = Navigator & {
    windowControlsOverlay?: WindowControlsOverlay
}

const { isLoading: isIndicatorLoading } = useLoadingIndicator({
    duration: 10000,
    throttle: 2000,
    // This is how progress is calculated by default
    // estimatedProgress: (duration, elapsed) => (2 / Math.PI * 100) * Math.atan(elapsed / duration * 100 / 50),
})

// Force light mode — dark mode will be planned and implemented properly later
const colorMode = useColorMode()
colorMode.preference = 'light'
// same as set(0, { force: true })
// set the progress to 0, and show loading immediately
// start({ force: true })
const router = useRouter()

// Notification modal state
const showNotificationModal = ref(false)

const { onOnline, onOffline } = useNetworkStatus()
const toast = useToast()

// Single offline/online toast identifiers for deduplication
const OFFLINE_TOAST_ID = 'network-status-toast-offline'
const ONLINE_TOAST_ID = 'network-status-toast-online'

onMounted(() => {
    if (import.meta.client) {
        onOffline(() => {
            toast.add({
                id: OFFLINE_TOAST_ID,
                title: "You are offline",
                description: "You can continue working. Changes will sync when you reconnect.",
                color: "warning",
                icon: "heroicons:wifi",
                duration: 5000,
            })
            // Remove the online toast if it's showing
            toast.remove(ONLINE_TOAST_ID)
        })

        onOnline(() => {
            toast.add({
                id: ONLINE_TOAST_ID,
                title: "Back online",
                description: "Connection restored.",
                color: "success",
                icon: "heroicons:wifi-solid",
                duration: 3000,
            })
            // Remove the offline toast if it's showing
            toast.remove(OFFLINE_TOAST_ID)
        })

    }
})

const ErrorLogger = (error: unknown): void => {
    console.error('🚨 [APP.VUE] Error logged, redirecting to error page', error)
    router.replace({
        name: 'error',
        params: {
            error: error instanceof Error ? error.message : String(error)
        }
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
    const navigatorWithOverlay = navigator as NavigatorWithWindowControlsOverlay
    if (navigatorWithOverlay.windowControlsOverlay) {
        navigatorWithOverlay.windowControlsOverlay.addEventListener('geometrychange', () => {
            const { width } = navigatorWithOverlay.windowControlsOverlay!.getTitlebarAreaRect();

            // Yes, we could do this with a media-query, but we only care
            // if the window-controls-overlay feature is being used.
            document.body.classList.toggle('narrow', width < 250);
        });
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

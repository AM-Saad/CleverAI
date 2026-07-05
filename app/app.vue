<template>
    <div>
        <Html lang="en" />
        <Link rel="manifest" href="/manifest.webmanifest" />
        <NuxtErrorBoundary @error="ErrorLogger">
            <template #error="{ error, clearError }">
                <div class="min-h-screen bg-background text-content-on-surface flex items-center justify-center px-6">
                    <div class="w-full  rounded-[var(--radius-xl)] border border-secondary p-6 shadow-[var(--shadow-dropdown)]">
                        <p class="text-xs font-bold uppercase tracking-widest text-content-secondary">Application Error
                        </p>
                        <ui-title tag="h1" size="xl" weight="semibold" class="mt-2">Something went wrong</ui-title>
                        <p class="mt-2 text-sm text-content-secondary break-words">
                            {{ error?.message || 'The app hit an unexpected rendering error.' }}
                        </p>
                        <div class="mt-5 flex gap-2">
                            <ui-button tone="primary" @click="() => { clearError(); reloadApp(); }">
                                Reload
                            </ui-button>
                            <ui-button tone="neutral" variant="soft" @click="() => { clearError(); goHome(); }">
                                Home
                            </ui-button>
                        </div>
                    </div>
                </div>
            </template>

            <NuxtLoadingIndicator color="var(--color-accent-orange)" :duration="10000" :throttle="6000" :reset-delay="5000" />
            <UApp>

                <NuxtLayout>

                    <NuxtPage />
                </NuxtLayout>

                <!-- Development Testing Dashboard -->
                <!-- <LazyDebugTestingDashboard /> -->

                <!-- Notification Subscription Modal -->
                <ClientOnly>
                    <Teleport to="body">
                        <NotificationSubscriptionModal :show="showNotificationModal"
                            @close="handleNotificationModalClose" @subscribed="handleNotificationSubscribed"
                            @dismissed="handleNotificationDismissed" />
                    </Teleport>
                </ClientOnly>

                <!-- Global credits wallet — opened via creditsStore.openWallet() from
                     anywhere (quota/upgrade flows). Mounted here so it survives the
                     mobile shell, not the retired header layout. -->
                <ClientOnly>
                    <shared-credits-wallet v-if="status === 'authenticated'" :is-open="creditsStore.isWalletOpen"
                        @close="creditsStore.closeWallet()" />
                </ClientOnly>

            </UApp>
        </NuxtErrorBoundary>
    </div>
</template>

<script setup lang="ts">
import NotificationSubscriptionModal from '~/features/notifications/components/NotificationSubscriptionModal.vue'
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

const colorMode = useColorMode()
if (import.meta.client && !colorMode.preference) {
    colorMode.preference = 'system'
}

// Auth + credits for the global wallet mount (quota/upgrade flows trigger it).
const { status } = useAuth()
const creditsStore = useCreditsStore()
// same as set(0, { force: true })
// set the progress to 0, and show loading immediately
// start({ force: true })
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
                icon: "i-lucide-wifi",
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
                icon: "i-lucide-wifi",
                duration: 3000,
            })
            // Remove the offline toast if it's showing
            toast.remove(OFFLINE_TOAST_ID)
        })

    }
})

const ErrorLogger = (error: unknown): void => {
    console.error('🚨 [APP.VUE] Error captured by boundary', error)
}

const reloadApp = () => {
    if (import.meta.client) window.location.reload()
}

const goHome = () => {
    if (import.meta.client) window.location.href = '/'
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



// Utility function to convert VAPID key
function urlBase64ToUint8Array(base64String: string): Uint8Array {
    const padding = "=".repeat((4 - (base64String.length % 4)) % 4)
    const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/")

    const rawData = window.atob(base64)
    const outputArray = new Uint8Array(rawData.length)

    for (let i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i)
    }
    return outputArray
}

export function useNotifications() {
    const isLoading = ref(false)
    const error = ref<string | null>(null)
    const isSubscribed = ref(false)
    const config = useRuntimeConfig()
    const { data } = useAuth()
    // @ts-expect-error - auth user might have id property
    const userId = data.value?.user?.id

     const checkPermission = async (): Promise<NotificationPermission> => {
        if (!('Notification' in window)) {
            throw new Error('This browser does not support notifications')
        }
        return Notification.permission
    }

    const checkServiceWorkerSupport = async (): Promise<void> => {
        if (!('serviceWorker' in navigator)) {
            throw new Error('Service Worker not supported')
        }

        if (!('PushManager' in window)) {
            throw new Error('Push notifications not supported')
        }
    }

    const registerNotification = async (): Promise<void> => {
        console.log("Registering notification...")
        try {
            error.value = null
            await checkServiceWorkerSupport()

            let permission = await checkPermission()

            if (permission === 'default') {
                permission = await Notification.requestPermission()
            }
            console.log("Notification permission status:", permission)
            if (permission === 'denied') {
                throw new Error('Notification permission denied. Please enable notifications in your browser settings.')
            }

            if (permission !== 'granted') {
                throw new Error(`Notification permission ${permission}`)
            }

            console.log("Notification permission granted")

            const registration = await navigator.serviceWorker.ready

            // Check if already subscribed
            const existingSubscription = await registration.pushManager.getSubscription()
            console.log("Existing subscription:", existingSubscription)
            if (existingSubscription) {
                isSubscribed.value = true
                console.log('Already subscribed to push notifications')
                return
            }

            isLoading.value = true
            console.log("Notification permission granted")

            const subscription = await registration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: urlBase64ToUint8Array(
                    config.public.VAPID_PUBLIC_KEY as string,
                ) as BufferSource,
            })

            // Get current user from auth session
            // TODO: Replace with actual session when auth is implemented


            // Properly serialize the subscription object
            const subscriptionData = {
                endpoint: subscription.endpoint,
                keys: {
                    auth: subscription.getKey('auth') ? btoa(String.fromCharCode(...new Uint8Array(subscription.getKey('auth')!))) : '',
                    p256dh: subscription.getKey('p256dh') ? btoa(String.fromCharCode(...new Uint8Array(subscription.getKey('p256dh')!))) : ''
                },
                userId: userId
            }

            console.log('Sending subscription data:', subscriptionData)

            // Send the subscription object to the server
            await $fetch("/api/notifications/subscribe", {
                method: "POST",
                body: subscriptionData,
            })
            // If request didn't throw, consider it successful under unified contract
            isSubscribed.value = true
            console.log("Subscription successful")

        } catch (err: unknown) {
            const errorMessage = err instanceof Error ? err.message : 'Failed to register notifications'
            error.value = errorMessage
            console.error("Notification registration error:", err)
        } finally {
            isLoading.value = false
        }
    }

    const unsubscribe = async (): Promise<void> => {
        try {
            const registration = await navigator.serviceWorker.ready
            const subscription = await registration.pushManager.getSubscription()

            if (subscription) {
                // First unsubscribe from browser
                await subscription.unsubscribe()

                // Then notify server to remove from database
                try {
                    await $fetch('/api/notifications/unsubscribe', {
                        method: 'POST',
                        body: { endpoint: subscription.endpoint }
                    })
                } catch (serverError) {
                    console.warn('Failed to remove subscription from server:', serverError)
                    // Continue anyway since browser unsubscription succeeded
                }

                isSubscribed.value = false
                console.log('Unsubscribed from push notifications')
            }
        } catch (err) {
            console.error('Error unsubscribing:', err)
            error.value = err instanceof Error ? err.message : 'Failed to unsubscribe'
        }
    }

    const checkSubscriptionStatus = async (): Promise<void> => {
        try {
            const registration = await navigator.serviceWorker.ready
            const subscription = await registration.pushManager.getSubscription()
            isSubscribed.value = !!subscription
        } catch (err) {
            console.error('Error checking subscription status:', err)
        }
    }

    const refreshSubscription = async (): Promise<void> => {
        console.log('🔄 Refreshing push notification subscription...')
        try {
            error.value = null
            isLoading.value = true

            // First unsubscribe if there's an existing subscription
            const registration = await navigator.serviceWorker.ready
            const existingSubscription = await registration.pushManager.getSubscription()

            if (existingSubscription) {
                console.log('🗑️ Removing existing subscription...')
                await existingSubscription.unsubscribe()

                // Remove from server database
                try {
                    await $fetch('/api/notifications/unsubscribe', {
                        method: 'POST',
                        body: { endpoint: existingSubscription.endpoint }
                    })
                    console.log('✅ Existing subscription removed from server')
                } catch (serverError) {
                    console.warn('⚠️ Failed to remove old subscription from server:', serverError)
                }
            }

            // Now create a fresh subscription
            await registerNotification()
            console.log('✅ Fresh subscription created!')

        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Failed to refresh subscription'
            error.value = errorMessage
            console.error('❌ Subscription refresh error:', err)
        } finally {
            isLoading.value = false
        }
    }

    return {
        isLoading,
        error,
        isSubscribed,
        registerNotification,
        unsubscribe,
        checkPermission,
        checkSubscriptionStatus,
        refreshSubscription,
    }
}

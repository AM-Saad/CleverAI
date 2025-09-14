<template>
    <div class="max-w-2xl mx-auto p-6">
        <h1 class="text-3xl font-bold mb-6">Test Notification Send Endpoint</h1>

        <!-- Subscription Status Card -->
        <UCard class="mb-6">
            <template #header>
                <h2 class="text-xl font-semibold">Notification Subscription</h2>
            </template>

            <div class="space-y-4">
                <div class="flex items-center justify-between">
                    <span>Subscription Status:</span>
                    <UBadge :color="isSubscribed ? 'green' : 'red'">
                        {{ isSubscribed ? 'Subscribed' : 'Not Subscribed' }}
                    </UBadge>
                </div>

                <div class="flex gap-2">
                    <UButton color="primary" :loading="isLoading" :disabled="isSubscribed"
                        @click="registerNotification">
                        Subscribe to Notifications
                    </UButton>

                    <UButton color="red" variant="outline" :disabled="!isSubscribed" @click="unsubscribe">
                        Unsubscribe
                    </UButton>

                    <UButton color="orange" variant="outline" :loading="isLoading" @click="refreshSubscription">
                        🔄 Refresh Subscription
                    </UButton>

                    <UButton variant="outline" @click="checkSubscriptionStatus">
                        Check Status
                    </UButton>
                </div>

                <div v-if="notificationError" class="text-red-500 text-sm">
                    {{ notificationError }}
                </div>
            </div>
        </UCard>

        <UCard>
            <template #header>
                <h2 class="text-xl font-semibold">Send Test Notification</h2>
            </template>

            <UForm :schema="schema" :state="state" @submit="sendNotification">
                <UFormGroup label="Title" name="title" class="mb-4">
                    <UInput v-model="state.title" placeholder="Enter notification title" />
                </UFormGroup>

                <UFormGroup label="Message" name="message" class="mb-4">
                    <UTextarea v-model="state.message" placeholder="Enter notification message" />
                </UFormGroup>

                <UFormGroup label="Icon URL" name="icon" class="mb-4">
                    <UInput v-model="state.icon" placeholder="/icons/192x192.png" />
                </UFormGroup>

                <UFormGroup label="Tag" name="tag" class="mb-4">
                    <UInput v-model="state.tag" placeholder="notification-tag" />
                </UFormGroup>

                <UFormGroup label="URL (Click Destination)" name="url" class="mb-4">
                    <UInput v-model="state.url" placeholder="/folders or https://example.com" />
                </UFormGroup>

                <UFormGroup label="Target Users" name="targetUsers" class="mb-4">
                    <UInput v-model="targetUsersInput" placeholder="user1,user2,user3 (optional)" />
                </UFormGroup>

                <div class="flex items-center mb-4">
                    <UCheckbox v-model="state.requireInteraction" />
                    <label class="ml-2">Require Interaction</label>
                </div>

                <UButton type="submit" :loading="loading" :disabled="loading">
                    Send Notification
                </UButton>

                <UButton variant="outline" :disabled="!isSubscribed" @click="testDirectNotification">
                    Test Direct Notification
                </UButton>

                <UButton color="blue" variant="outline" :disabled="!isSubscribed" @click="testConnection">
                    🧪 Test Connection
                </UButton>

                <!-- Production Service Worker Controls -->
                <div class="mt-6 p-4 bg-gray-50 rounded-lg">
                    <h3 class="font-medium mb-3">Service Worker Status</h3>
                    <div class="flex flex-wrap gap-2 mb-3">
                        <UBadge :color="swController ? 'green' : 'red'">
                            {{ swController ? 'SW Active' : 'SW Inactive' }}
                        </UBadge>
                        <UBadge :color="swUpdateAvailable ? 'yellow' : 'gray'">
                            {{ swUpdateAvailable ? 'Update Available' : 'Up to Date' }}
                        </UBadge>
                    </div>
                    <div class="flex flex-wrap gap-2">
                        <UButton size="xs" variant="outline" @click="checkSWStatus">
                            Check Status
                        </UButton>
                        <UButton size="xs" variant="outline" @click="checkForSWUpdates">
                            Check for Updates
                        </UButton>
                        <UButton v-if="swUpdateAvailable" size="xs" color="primary" :loading="swUpdating"
                            @click="applySWUpdate">
                            Apply Update
                        </UButton>
                    </div>
                </div>

                <!-- Development Mode Service Worker Controls -->
                <div v-if="isDev" class="mt-4 p-4 bg-amber-50 border border-amber-200 rounded-lg">
                    <h3 class="font-medium mb-3 text-amber-800">🔧 Development Mode Controls</h3>
                    <div class="grid grid-cols-2 gap-2 mb-3">
                        <UButton size="xs" variant="outline" color="orange" @click="forceServiceWorkerUpdate">
                            Force SW Update
                        </UButton>
                        <UButton size="xs" variant="outline" color="orange" @click="forceServiceWorkerControl">
                            Force SW Control
                        </UButton>
                        <UButton size="xs" variant="outline" color="orange" @click="manualRefresh">
                            Manual Refresh
                        </UButton>
                        <UButton size="xs" variant="outline" color="orange" @click="debugServiceWorker">
                            Debug SW
                        </UButton>
                        <UButton size="xs" variant="outline" color="orange" @click="testServiceWorkerMessage">
                            Test SW Message
                        </UButton>
                        <UButton size="xs" variant="outline" color="orange" @click="simulateUpdateAvailable">
                            Simulate Update
                        </UButton>
                    </div>
                    <div class="flex gap-2 mb-2">
                        <UButton size="xs" variant="outline" color="red" @click="resetUpdateState">
                            Reset Update State
                        </UButton>
                    </div>
                    <p class="text-xs text-amber-600">
                        ⚠️ These controls are only available in development mode
                    </p>
                </div>
            </UForm>
        </UCard>

        <UCard v-if="result" class="mt-6">
            <template #header>
                <h3 class="text-lg font-semibold" :class="result.success ? 'text-green-600' : 'text-red-600'">
                    {{ result.success ? 'Success' : 'Error' }}
                </h3>
            </template>

            <div class="space-y-2">
                <div><strong>Status:</strong> {{ result.status }}</div>
                <div><strong>Response:</strong></div>
                <pre
                    class="bg-gray-100 p-3 rounded text-sm overflow-auto">{{ JSON.stringify(result.data, null, 2) }}</pre>
            </div>
        </UCard>
    </div>
</template>

<script setup>
import { z } from 'zod'

// Notification composable
const {
    isLoading,
    error: notificationError,
    isSubscribed,
    registerNotification,
    unsubscribe,
    checkSubscriptionStatus,
    refreshSubscription
} = useNotifications()

// Service Worker Updates composable
const {
    updateAvailable: swUpdateAvailable,
    isUpdating: swUpdating,
    checkForUpdates: checkForSWUpdates,
    applyUpdate: applySWUpdate,
    // Dev mode functions
    forceServiceWorkerUpdate,
    forceServiceWorkerControl,
    manualRefresh,
    debugServiceWorker,
    testServiceWorkerMessage,
    simulateUpdateAvailable,
    resetUpdateState
} = useServiceWorkerUpdates()

// Service Worker status
const swController = ref(false)

// Development mode detection
const isDev = import.meta.dev

// Check SW status
const checkSWStatus = () => {
    swController.value = !!navigator.serviceWorker.controller
    console.log('🔍 SW Controller:', navigator.serviceWorker.controller)
}

// Check subscription status on mount
onMounted(() => {
    checkSubscriptionStatus()
})

// Define validation schema
const schema = z.object({
    title: z.string().min(1).max(100),
    message: z.string().min(1).max(500),
    icon: z.string().optional(),
    tag: z.string().optional(),
    url: z.string().optional(),
    requireInteraction: z.boolean().default(false)
})

// Reactive state
const state = reactive({
    title: 'Test Notification',
    message: 'This is a test message from the notification endpoint',
    icon: '/icons/192x192.png',
    tag: 'test',
    url: '/folders',
    requireInteraction: false
})

const targetUsersInput = ref('')
const loading = ref(false)
const result = ref(null)

// Send notification function
async function sendNotification() {
    loading.value = true
    result.value = null

    try {
        // Prepare the request data
        const requestData = {
            ...state,
            // Convert comma-separated string to array if provided
            targetUsers: targetUsersInput.value
                ? targetUsersInput.value.split(',').map(u => u.trim()).filter(Boolean)
                : undefined
        }

        // Remove undefined values
        const cleanedData = Object.fromEntries(
            Object.entries(requestData).filter(([_, value]) => value !== undefined && value !== '')
        )

        console.log('Sending notification:', cleanedData)

        const response = await $fetch('/api/notifications/send', {
            method: 'POST',
            body: cleanedData
        })

        result.value = {
            success: true,
            status: 200,
            data: response
        }

        console.log('Notification sent successfully:', response)

    } catch (error) {
        console.error('Failed to send notification:', error)

        result.value = {
            success: false,
            status: error.status || 500,
            data: error.data || { message: error.message }
        }
    } finally {
        loading.value = false
    }
}

// Test direct notification using service worker
async function testDirectNotification() {
    try {
        console.log('🔔 Testing direct notification...')

        if (Notification.permission !== 'granted') {
            console.error('Notification permission not granted')
            return
        }

        const registration = await navigator.serviceWorker.ready
        console.log('🔔 Service worker ready:', registration)

        await registration.showNotification('Direct Test Notification', {
            body: 'Click this to test navigation to /folders',
            icon: '/icons/192x192.png',
            tag: 'direct-test',
            data: {
                url: '/folders',
                timestamp: Date.now()
            }
        })

        console.log('✅ Direct notification shown')

    } catch (error) {
        console.error('❌ Error showing direct notification:', error)
    }
}

// Test connection function
async function testConnection() {
    loading.value = true
    result.value = null

    try {
        const { testPushNotifications } = await import('~/utils/notificationHelper')
        const testResult = await testPushNotifications()

        if (testResult.needsRefresh) {
            // Ask user if they want to refresh
            const shouldRefresh = confirm('Your push subscription has expired. Would you like to refresh it?')
            if (shouldRefresh) {
                await refreshSubscription()
                // Test again after refresh
                const retestResult = await testPushNotifications()
                result.value = {
                    success: retestResult.success,
                    status: retestResult.success ? 200 : 500,
                    data: { message: retestResult.message, details: retestResult.details }
                }
            } else {
                result.value = {
                    success: false,
                    status: 410,
                    data: { message: testResult.message, needsRefresh: true }
                }
            }
        } else {
            result.value = {
                success: testResult.success,
                status: testResult.success ? 200 : 500,
                data: { message: testResult.message, details: testResult.details }
            }
        }

    } catch (error) {
        const err = error
        result.value = {
            success: false,
            status: 500,
            data: { message: `Connection test failed: ${err.message}` }
        }
    } finally {
        loading.value = false
    }
}

// Check subscription status on mount
onMounted(() => {
    checkSubscriptionStatus()
    checkSWStatus()
})

// Page meta
definePageMeta({
    title: 'Test Notifications'
})
</script>

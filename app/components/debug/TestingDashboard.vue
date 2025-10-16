<template>
    <div v-if="isDev" class="fixed bottom-4 right-4 z-50">
        <!-- Floating Action Button -->
        <button v-if="!showPanel"
            class="bg-purple-600 hover:bg-purple-700 text-white p-3 rounded-full shadow-lg transition-all duration-200 transform hover:scale-110"
            title="Open Testing Dashboard" @click="showPanel = true">
            <UIcon name="i-heroicons-beaker" class="w-6 h-6" />
        </button>

        <!-- Dashboard Panel -->
        <div v-if="showPanel"
            class="bg-white dark:bg-gray-800 rounded-lg shadow-2xl border border-gray-200 dark:border-gray-700 p-6 w-96 max-h-[80vh] overflow-y-auto">
            <!-- Header -->
            <div class="flex justify-between items-center mb-4">
                <h2 class="text-lg font-semibold text-gray-900 dark:text-gray-100 flex items-center">
                    <UIcon name="i-heroicons-beaker" class="w-5 h-5 mr-2 text-purple-600" />
                    🧪 Testing Dashboard
                </h2>
                <button @click="showPanel = false" class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
                    <UIcon name="i-heroicons-x-mark" class="w-5 h-5" />
                </button>
            </div>

            <!-- Quick Status -->
            <div class="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 mb-4">
                <h3 class="font-medium text-gray-900 dark:text-gray-100 mb-2">System Status</h3>
                <div class="space-y-2 text-sm">
                    <div class="flex justify-between">
                        <span class="text-gray-600 dark:text-gray-400">Server Time:</span>
                        <span class="font-mono">{{ serverTime }}</span>
                    </div>
                    <div class="flex justify-between">
                        <span class="text-gray-600 dark:text-gray-400">User Timezone:</span>
                        <span class="font-mono">{{ userTimezone }}</span>
                    </div>
                    <div class="flex justify-between">
                        <span class="text-gray-600 dark:text-gray-400">User Local Time:</span>
                        <span class="font-mono">{{ userLocalTime }}</span>
                    </div>
                    <div class="flex justify-between">
                        <span class="text-gray-600 dark:text-gray-400">Cron Schedule:</span>
                        <span class="font-mono">*/15 * * * *</span>
                    </div>
                </div>
            </div>

            <!-- Quick Actions -->
            <div class="space-y-4">
                <!-- Manual Cron Trigger -->
                <div>
                    <h3 class="font-medium text-gray-900 dark:text-gray-100 mb-2">⚡ Quick Actions</h3>
                    <div class="space-y-2">
                        <button @click="triggerCron" :disabled="isTriggering"
                            class="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-lg transition-colors flex items-center justify-center">
                            <UIcon v-if="isTriggering" name="i-heroicons-arrow-path"
                                class="w-4 h-4 mr-2 animate-spin" />
                            {{ isTriggering ? 'Triggering...' : '🚀 Trigger Cron Now' }}
                        </button>

                        <button @click="openNotificationSettings"
                            class="w-full px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors">
                            ⚙️ Open Notification Settings
                        </button>

                        <button @click="openReviewInterface"
                            class="w-full px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors">
                            📚 Open Review Interface
                        </button>
                    </div>
                </div>

                <!-- Notification Scenarios -->
                <div>
                    <h3 class="font-medium text-gray-900 dark:text-gray-100 mb-2">🎯 Test Scenarios</h3>
                    <div class="space-y-2">
                        <button v-for="scenario in scenarios" :key="scenario.id" @click="loadScenario(scenario)"
                            class="w-full px-3 py-2 text-left bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 rounded-lg transition-colors text-sm">
                            <div class="font-medium">{{ scenario.emoji }} {{ scenario.name }}</div>
                            <div class="text-xs text-gray-600 dark:text-gray-400">{{ scenario.description }}</div>
                        </button>
                    </div>
                </div>

                <!-- Current Preferences Summary -->
                <div v-if="preferences">
                    <h3 class="font-medium text-gray-900 dark:text-gray-100 mb-2">📋 Current Settings</h3>
                    <div class="bg-gray-50 dark:bg-gray-700 rounded-lg p-3 text-xs space-y-1">
                        <div class="flex justify-between">
                            <span>Card Due Time:</span>
                            <span class="font-mono">{{ preferences.cardDueTime }}</span>
                        </div>
                        <div class="flex justify-between">
                            <span>Threshold:</span>
                            <span class="font-mono">{{ preferences.cardDueThreshold }} cards</span>
                        </div>
                        <div class="flex justify-between">
                            <span>Timezone:</span>
                            <span class="font-mono">{{ preferences.timezone }}</span>
                        </div>
                        <div class="flex justify-between">
                            <span>Quiet Hours:</span>
                            <span class="font-mono">
                                {{ preferences.quietHoursEnabled ?
                                    `${preferences.quietHoursStart}-${preferences.quietHoursEnd}` : 'Disabled' }}
                            </span>
                        </div>
                        <div class="flex justify-between">
                            <span>Daily Reminder:</span>
                            <span class="font-mono">
                                {{ preferences.dailyReminderEnabled ? preferences.dailyReminderTime : 'Disabled' }}
                            </span>
                        </div>
                    </div>
                </div>

                <!-- Last Cron Result -->
                <div v-if="lastCronResult">
                    <h3 class="font-medium text-gray-900 dark:text-gray-100 mb-2">📊 Last Test Result</h3>
                    <div class="bg-gray-50 dark:bg-gray-700 rounded-lg p-3 text-xs">
                        <div class="flex justify-between mb-1">
                            <span>Status:</span>
                            <span :class="lastCronResult.success ? 'text-green-600' : 'text-red-600'"
                                class="font-medium">
                                {{ lastCronResult.success ? '✅ Success' : '❌ Failed' }}
                            </span>
                        </div>
                        <div class="flex justify-between mb-1">
                            <span>Processed:</span>
                            <span class="font-mono">{{ lastCronResult.results?.processed || 0 }} users</span>
                        </div>
                        <div class="flex justify-between mb-1">
                            <span>Notifications:</span>
                            <span class="font-mono">{{ lastCronResult.results?.notificationsSent || 0 }} sent</span>
                        </div>
                        <div class="flex justify-between">
                            <span>Skipped:</span>
                            <span class="font-mono">{{ lastCronResult.results?.skipped || 0 }} users</span>
                        </div>
                    </div>
                </div>

                <!-- Debug Links -->
                <div>
                    <h3 class="font-medium text-gray-900 dark:text-gray-100 mb-2">🔗 Quick Links</h3>
                    <div class="space-y-1 text-xs">
                        <a href="/api/admin/cron/status" target="_blank"
                            class="block text-blue-600 hover:text-blue-800 dark:text-blue-400">
                            📊 Cron Status API
                        </a>
                        <a href="/api/notifications/preferences" target="_blank"
                            class="block text-blue-600 hover:text-blue-800 dark:text-blue-400">
                            ⚙️ Preferences API
                        </a>
                        <button @click="openBrowserConsole"
                            class="text-blue-600 hover:text-blue-800 dark:text-blue-400">
                            💻 Browser Console Guide
                        </button>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
interface NotificationPreferences {
    cardDueEnabled: boolean
    cardDueTime: string
    cardDueThreshold: number
    dailyReminderEnabled: boolean
    dailyReminderTime: string
    timezone: string
    quietHoursEnabled: boolean
    quietHoursStart: string
    quietHoursEnd: string
    sendAnytimeOutsideQuietHours: boolean
    activeHoursEnabled: boolean
    activeHoursStart: string
    activeHoursEnd: string
}

interface TestScenario {
    id: string
    name: string
    emoji: string
    description: string
    settings: Partial<NotificationPreferences>
}

interface CronResult {
    success: boolean
    data?: Record<string, unknown>
    results?: {
        processed: number
        notificationsSent: number
        skipped: number
    }
    message?: string
}

const isDev = process.env.NODE_ENV === 'development'
const showPanel = ref(false)
const isTriggering = ref(false)
const preferences = ref<NotificationPreferences | null>(null)
const lastCronResult = ref<CronResult | null>(null)

// Time displays
const serverTime = ref('')
const userTimezone = ref('')
const userLocalTime = ref('')

// Test scenarios
const scenarios: TestScenario[] = [
    {
        id: 'new-user',
        name: 'New User',
        emoji: '👋',
        description: 'Default settings for first-time user',
        settings: {
            cardDueEnabled: true,
            cardDueTime: '09:00',
            cardDueThreshold: 5,
            timezone: 'America/New_York',
            quietHoursEnabled: false,
            dailyReminderEnabled: false
        }
    },
    {
        id: 'power-user',
        name: 'Power User',
        emoji: '💪',
        description: 'High threshold, early notifications',
        settings: {
            cardDueEnabled: true,
            cardDueTime: '07:00',
            cardDueThreshold: 20,
            timezone: 'America/Los_Angeles',
            quietHoursEnabled: true,
            quietHoursStart: '23:00',
            quietHoursEnd: '06:00',
            dailyReminderEnabled: true,
            dailyReminderTime: '20:00'
        }
    },
    {
        id: 'casual-learner',
        name: 'Casual Learner',
        emoji: '🌱',
        description: 'Low threshold, evening study',
        settings: {
            cardDueEnabled: true,
            cardDueTime: '19:00',
            cardDueThreshold: 3,
            timezone: 'Europe/London',
            quietHoursEnabled: true,
            quietHoursStart: '22:00',
            quietHoursEnd: '08:00',
            dailyReminderEnabled: true,
            dailyReminderTime: '18:30'
        }
    },
    {
        id: 'night-owl',
        name: 'Night Owl',
        emoji: '🦉',
        description: 'Late night study sessions',
        settings: {
            cardDueEnabled: true,
            cardDueTime: '23:00',
            cardDueThreshold: 1,
            timezone: 'Asia/Tokyo',
            quietHoursEnabled: true,
            quietHoursStart: '02:00',
            quietHoursEnd: '10:00',
            dailyReminderEnabled: false
        }
    },
    {
        id: 'timezone-test',
        name: 'Timezone Edge',
        emoji: '🌍',
        description: 'Test timezone conversions',
        settings: {
            cardDueEnabled: true,
            cardDueTime: getCurrentTime(), // Set to current time for immediate testing
            cardDueThreshold: 1,
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            quietHoursEnabled: false,
            dailyReminderEnabled: false
        }
    }
]

// Get current time in HH:MM format
function getCurrentTime(): string {
    const now = new Date()
    return now.toTimeString().slice(0, 5)
}

// Update time displays
const updateTimes = () => {
    const now = new Date()
    serverTime.value = now.toTimeString().slice(0, 8)
    userTimezone.value = Intl.DateTimeFormat().resolvedOptions().timeZone

    try {
        userLocalTime.value = now.toLocaleString('en-US', {
            timeZone: userTimezone.value,
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: false
        })
    } catch {
        userLocalTime.value = 'Invalid timezone'
    }
}

// Load current preferences
const loadPreferences = async () => {
    try {
        const { data } = await $fetch('/api/notifications/preferences')
        preferences.value = data
    } catch (error) {
        console.error('Failed to load preferences:', error)
    }
}

// Trigger cron job manually
const triggerCron = async () => {
    isTriggering.value = true
    try {
        const result = await $fetch('/api/admin/cron/trigger/check-due-cards', {
            method: 'POST',
            headers: {
                'x-cron-secret': 'test-secret-token-for-debugging'
            }
        }) as CronResult
        lastCronResult.value = result
        console.log('✅ Cron triggered successfully:', result)

        // Show toast notification
        const toast = useToast()
        toast.add({
            title: 'Cron Triggered',
            description: `Processed: ${result.results?.processed || 0}, Sent: ${result.results?.notificationsSent || 0}`,
            color: 'success'
        })
    } catch (error) {
        console.error('❌ Failed to trigger cron:', error)
        const toast = useToast()
        toast.add({
            title: 'Cron Failed',
            description: 'Check console for details',
            color: 'error'
        })
    } finally {
        isTriggering.value = false
    }
}

// Load a test scenario
const loadScenario = async (scenario: TestScenario) => {
    try {
        const updatedSettings = { ...preferences.value, ...scenario.settings } as NotificationPreferences

        await $fetch('/api/notifications/preferences', {
            method: 'PUT',
            body: updatedSettings
        })

        preferences.value = updatedSettings

        const toast = useToast()
        toast.add({
            title: `${scenario.emoji} Scenario Loaded`,
            description: `${scenario.name} settings applied`,
            color: 'success'
        })

        console.log(`✅ Loaded scenario: ${scenario.name}`, updatedSettings)
    } catch (error) {
        console.error('❌ Failed to load scenario:', error)
        const toast = useToast()
        toast.add({
            title: 'Scenario Failed',
            description: 'Check console for details',
            color: 'error'
        })
    }
}

// Navigation helpers
const openNotificationSettings = () => {
    navigateTo('/settings/notifications')
}

const openReviewInterface = () => {
    // Find a folder with cards and navigate to review
    navigateTo('/folders') // User can then select a folder to review
}

const openBrowserConsole = () => {
    console.log(`
🧪 TESTING DASHBOARD CONSOLE GUIDE

📋 Quick Commands:
// Check current user timezone
console.log('User timezone:', Intl.DateTimeFormat().resolvedOptions().timeZone)

// Get current notification preferences
fetch('/api/notifications/preferences').then(r => r.json()).then(console.log)

// Trigger cron manually
fetch('/api/admin/cron/trigger/check-due-cards', {
  method: 'POST',
  headers: { 'x-cron-secret': 'test-secret-token-for-debugging' }
}).then(r => r.json()).then(console.log)

// Check cron status
fetch('/api/admin/cron/status').then(r => r.json()).then(console.log)

🎯 Testing Tips:
1. Set notification time to current time + 2 minutes
2. Use debug panel in review interface to set cards due now
3. Trigger cron manually to test immediately
4. Check server logs for timezone calculations
5. Verify notifications respect quiet hours and thresholds

📊 Monitor these API endpoints:
- /api/notifications/preferences (GET/PUT)
- /api/admin/cron/trigger/check-due-cards (POST)
- /api/admin/cron/status (GET)
- /api/review/debug/update (POST) - Debug panel updates
`)
}

// Lifecycle
onMounted(() => {
    if (isDev) {
        updateTimes()
        loadPreferences()

        // Update times every second
        setInterval(updateTimes, 1000)
    }
})
</script>

<style scoped>
/* Custom animations */
@keyframes fadeIn {
    from {
        opacity: 0;
        transform: translateY(10px);
    }

    to {
        opacity: 1;
        transform: translateY(0);
    }
}

.animate-fade-in {
    animation: fadeIn 0.2s ease-out;
}
</style>

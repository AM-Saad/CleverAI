<template>
    <!-- eslint-disable vue/max-attributes-per-line, vue/attributes-order -->
    <UCard>
        <template #header>
            <div class="flex items-center gap-2">
                <UIcon name="i-heroicons-bell" class="w-5 h-5" />
                <h3 class="text-lg font-semibold">Notification Preferences</h3>
            </div>
        </template>

        <div class="space-y-6">
            <!-- Card Due Notifications -->
            <div class="border rounded-lg p-4 space-y-4">
                <div class="flex items-center justify-between ">
                    <div>
                        <h4 class="text-base font-medium text-gray-900 dark:text-gray-100">
                            📚 Card Due Notifications
                        </h4>
                        <p class="text-sm text-gray-500 dark:text-gray-400">
                            Get notified when you have cards ready for review
                        </p>
                    </div>
                    <USwitch v-model="preferences.cardDueEnabled" :loading="loading" @change="updatePreferences" />
                </div>

                <!-- Card Due Settings -->
                <div v-if="preferences.cardDueEnabled"
                    class="space-y-3 pl-4 border-l-2 border-gray-200 dark:border-gray-700">
                    <UForm label="Notification Time" help="What time would you like to be notified?">
                        <div class="flex items-center gap-2">
                            <UIcon name="i-heroicons-clock" class="w-4 h-4 text-gray-400" />
                            <input v-model="preferences.cardDueTime" type="time"
                                class="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                                :disabled="loading || preferences.sendAnytimeOutsideQuietHours"
                                @change="updatePreferences">
                        </div>
                        <div v-if="preferences.sendAnytimeOutsideQuietHours"
                            class="mt-1 text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
                            <UIcon name="i-heroicons-information-circle" class="w-3 h-3" />
                            <span>Card Due Time is ignored when "Send Anytime" is enabled.</span>
                        </div>
                    </UForm>

                    <UFormField label="How often would you like to be notified?"
                        help="Choose how often you'd like to be notified about due cards">
                        <div class="space-y-3">
                            <!-- Threshold Selection -->
                            <div class="grid grid-cols-1 gap-3">
                                <div v-for="option in thresholdOptions" :key="option.value" :class="[
                                    'relative border rounded-lg p-4 cursor-pointer transition-all',
                                    preferences.cardDueThreshold === option.value
                                        ? 'border-primary bg-primary-50 dark:bg-primary-900/20'
                                        : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                                ]" @click="selectThreshold(option.value)">
                                    <div class="flex items-start gap-3">
                                        <div class="text-2xl">{{ option.emoji }}</div>
                                        <div class="flex-1">
                                            <div class="flex items-center gap-2">
                                                <h4 class="font-medium text-gray-900 dark:text-gray-100">
                                                    {{ option.title }}
                                                </h4>
                                                <span
                                                    class="text-xs text-gray-500 bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded">
                                                    {{ option.value }}+ cards
                                                </span>
                                            </div>
                                            <p class="text-sm text-gray-600 dark:text-gray-400 mt-1">
                                                {{ option.description }}
                                            </p>
                                        </div>
                                        <div v-if="preferences.cardDueThreshold === option.value" class="text-primary">
                                            <UIcon name="i-heroicons-check-circle" class="w-5 h-5" />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <!-- Custom Threshold Option -->
                            <div :class="[
                                'relative border rounded-lg p-4 cursor-pointer transition-all',
                                isCustomThreshold
                                    ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                                    : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                            ]" @click="selectCustomThreshold">
                                <div class="flex items-start gap-3">
                                    <div class="text-2xl">⚙️</div>
                                    <div class="flex-1">
                                        <div class="flex items-center gap-2">
                                            <h4 class="font-medium text-gray-900 dark:text-gray-100">
                                                Custom
                                            </h4>
                                            <div v-if="isCustomThreshold" class="flex items-center gap-2">
                                                <UInput v-model.number="customThresholdValue" type="number" min="1"
                                                    max="100" class="w-20" size="sm" :loading="loading"
                                                    @input="updateCustomThreshold" />
                                                <span class="text-xs text-gray-500">cards</span>
                                            </div>
                                        </div>
                                        <p class="text-sm text-gray-600 dark:text-gray-400 mt-1">
                                            Set your own notification threshold
                                        </p>
                                    </div>
                                    <div v-if="isCustomThreshold" class="text-primary-500">
                                        <UIcon name="i-heroicons-check-circle" class="w-5 h-5" />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </UFormField>
                </div>
            </div>

            <!-- Daily Study Reminders -->
            <div class="border rounded-lg p-4 space-y-4">
                <div class="flex items-center justify-between">
                    <div>
                        <h4 class="text-base font-medium text-gray-900 dark:text-gray-100">
                            📅 Daily Study Reminders
                        </h4>
                        <p class="text-sm text-gray-500 dark:text-gray-400">
                            Get reminded to study at a specific time each day
                        </p>
                    </div>
                    <USwitch v-model="preferences.dailyReminderEnabled" :loading="loading"
                        @change="updatePreferences" />
                </div>

                <!-- Daily Reminder Settings -->
                <div v-if="preferences.dailyReminderEnabled"
                    class="space-y-3 pl-4 border-l-2 border-gray-200 dark:border-gray-700">
                    <UFormGroup label="Reminder Time" help="What time would you like your daily reminder?">
                        <div class="flex items-center gap-2">
                            <UIcon name="i-heroicons-clock" class="w-4 h-4 text-gray-400" />
                            <input v-model="preferences.dailyReminderTime" type="time"
                                class="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                                :disabled="loading" @change="updatePreferences">
                        </div>
                    </UFormGroup>
                </div>
            </div>

            <!-- Quiet Hours -->
            <div class="border rounded-lg p-4 space-y-4">
                <div class="flex items-center justify-between">
                    <div>
                        <h4 class="text-base font-medium text-gray-900 dark:text-gray-100">
                            🤫 Quiet Hours
                        </h4>
                        <p class="text-sm text-gray-500 dark:text-gray-400">
                            No notifications during these hours
                        </p>
                    </div>
                    <USwitch v-model="preferences.quietHoursEnabled" :loading="loading" @change="updatePreferences" />
                </div>

                <!-- Quiet Hours Settings -->
                <div v-if="preferences.quietHoursEnabled"
                    class="space-y-3 pl-4 border-l-2 border-gray-200 dark:border-gray-700">
                    <div class="grid grid-cols-2 gap-4">
                        <UFormGroup label="Start Time">
                            <div class="flex items-center gap-2">
                                <UIcon name="i-heroicons-moon" class="w-4 h-4 text-gray-400" />
                                <input v-model="preferences.quietHoursStart" type="time"
                                    class="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                                    :disabled="loading" @change="updatePreferences">
                            </div>
                        </UFormGroup>

                        <UFormGroup label="End Time">
                            <div class="flex items-center gap-2">
                                <UIcon name="i-heroicons-sun" class="w-4 h-4 text-gray-400" />
                                <input v-model="preferences.quietHoursEnd" type="time"
                                    class="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                                    :disabled="loading" @change="updatePreferences">
                            </div>
                        </UFormGroup>
                    </div>

                    <div class="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
                        <UIcon name="i-heroicons-information-circle" class="w-3 h-3" />
                        <span>
                            Notifications will be delayed until after quiet hours end.
                        </span>
                    </div>
                </div>
            </div>

            <!-- Send Anytime (outside quiet hours) -->
            <div class="border rounded-lg p-4 space-y-4">
                <div class="flex items-center justify-between">
                    <div>
                        <h4 class="text-base font-medium text-gray-900 dark:text-gray-100">
                            🚀 Send Anytime (Outside Quiet Hours)
                        </h4>
                        <p class="text-sm text-gray-500 dark:text-gray-400">
                            If enabled, notifications can send at any time outside quiet hours once your due-card
                            threshold is
                            met.
                        </p>
                    </div>
                    <USwitch v-model="preferences.sendAnytimeOutsideQuietHours" :loading="loading"
                        @change="updatePreferences" />
                </div>
                <div class="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
                    <UIcon name="i-heroicons-information-circle" class="w-3 h-3" />
                    <span>
                        When disabled, notifications only send near your Card Due Time.
                    </span>
                </div>
            </div>

            <!-- Active Hours -->
            <div class="border rounded-lg p-4 space-y-4">
                <div class="flex items-center justify-between">
                    <div>
                        <h4 class="text-base font-medium text-gray-900 dark:text-gray-100">
                            🕘 Active Hours
                        </h4>
                        <p class="text-sm text-gray-500 dark:text-gray-400">
                            Only send notifications during these hours (in addition to quiet hours).
                        </p>
                    </div>
                    <USwitch v-model="preferences.activeHoursEnabled" :loading="loading" @change="updatePreferences" />
                </div>

                <div v-if="preferences.activeHoursEnabled"
                    class="space-y-3 pl-4 border-l-2 border-gray-200 dark:border-gray-700">
                    <div class="grid grid-cols-2 gap-4">
                        <UFormGroup label="Start">
                            <div class="flex items-center gap-2">
                                <UIcon name="i-heroicons-play" class="w-4 h-4 text-gray-400" />
                                <input v-model="preferences.activeHoursStart" type="time"
                                    class="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                                    :disabled="loading" @change="updatePreferences">
                            </div>
                        </UFormGroup>

                        <UFormGroup label="End">
                            <div class="flex items-center gap-2">
                                <UIcon name="i-heroicons-stop" class="w-4 h-4 text-gray-400" />
                                <input v-model="preferences.activeHoursEnd" type="time"
                                    class="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                                    :disabled="loading" @change="updatePreferences">
                            </div>
                        </UFormGroup>
                    </div>
                    <div class="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
                        <UIcon name="i-heroicons-information-circle" class="w-3 h-3" />
                        <span>
                            Midnight crossover is supported (e.g., 22:00–06:00).
                        </span>
                    </div>
                </div>
            </div>

            <!-- Timezone Settings -->
            <div class="border rounded-lg p-4 space-y-4">
                <div class="flex items-center justify-between">
                    <div>
                        <h4 class="text-base font-medium text-gray-900 dark:text-gray-100">
                            🌍 Timezone
                        </h4>
                        <p class="text-sm text-gray-500 dark:text-gray-400">
                            Set your local timezone for accurate notification timing
                        </p>
                    </div>
                </div>

                <UFormField label="Your Timezone"
                    help="All notification times will be converted to your local timezone">
                    <div class="relative inline-flex items-center gap-2">
                        <UIcon name="i-heroicons-globe-alt" class="w-4 h-4 text-gray-400" />
                        <select v-model="preferences.timezone" :disabled="loading"
                            class="px-2.5 py-1.5 text-sm rounded-md bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100"
                            @change="updatePreferences">
                            <option disabled value="">Select your timezone</option>
                            <option v-for="tz in timezoneOptions" :key="tz.value" :value="tz.value">
                                {{ tz.label }}
                            </option>
                        </select>
                    </div>
                </UFormField>

                <div class="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1 my-1">
                    <UIcon name="i-heroicons-information-circle" class="w-3 h-3" />
                    <span>
                        Current time in your timezone: {{ getCurrentUserTime() }}
                    </span>
                </div>
            </div>
        </div>

        <!-- Save Status -->
        <template v-if="lastSaved" #footer>
            <div class="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                <UIcon name="i-heroicons-check-circle" class="w-4 h-4 text-green-500" />
                <span>Settings saved {{ formatRelativeTime(lastSaved) }}</span>
            </div>
        </template>
    </UCard>
</template>

<script setup lang="ts">
import { useDebounceFn } from '@vueuse/core'

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

const toast = useToast()
const loading = ref(false)
const lastSaved = ref<Date | null>(null)

// Threshold options with engaging categories
const thresholdOptions = [
    {
        value: 1,
        title: "Instant Learner",
        emoji: "⚡",
        description: "Get notified as soon as any item is due. Perfect for staying on top of every review."
    },
    {
        value: 3,
        title: "Steady Studier",
        emoji: "📚",
        description: "Be notified when you have a few items ready. Great for regular, bite-sized study sessions."
    },
    {
        value: 5,
        title: "Focused Reviewer",
        emoji: "🎯",
        description: "Build up a small batch before reviewing. Ideal for concentrated study periods."
    },
    {
        value: 10,
        title: "Batch Processor",
        emoji: "📊",
        description: "Wait for a decent stack to accumulate. Perfect for longer, dedicated study sessions."
    },
    {
        value: 20,
        title: "Power Learner",
        emoji: "💪",
        description: "Great for intensive study marathons and maximum efficiency."
    }
]

// Timezone options for common timezones (mutable so we can inject the user's zone)
const timezoneOptions = ref([
    { value: 'UTC', label: '🌍 UTC (Coordinated Universal Time)' },
    { value: 'America/New_York', label: '🗽 Eastern Time (New York)' },
    { value: 'America/Chicago', label: '🏙️ Central Time (Chicago)' },
    { value: 'America/Denver', label: '🏔️ Mountain Time (Denver)' },
    { value: 'America/Los_Angeles', label: '🌴 Pacific Time (Los Angeles)' },
    { value: 'Europe/London', label: '🇬🇧 London (GMT/BST)' },
    { value: 'Europe/Paris', label: '🇫🇷 Paris (CET/CEST)' },
    { value: 'Europe/Berlin', label: '🇩🇪 Berlin (CET/CEST)' },
    { value: 'Europe/Rome', label: '🇮🇹 Rome (CET/CEST)' },
    { value: 'Asia/Tokyo', label: '🇯🇵 Tokyo (JST)' },
    { value: 'Asia/Shanghai', label: '🇨🇳 Shanghai (CST)' },
    { value: 'Asia/Dubai', label: '🇦🇪 Dubai (GST)' },
    { value: 'Australia/Sydney', label: '🇦🇺 Sydney (AEST/AEDT)' },
    { value: 'Pacific/Auckland', label: '🇳🇿 Auckland (NZST/NZDT)' }
])

const ensureTimezoneInOptions = (tz: string) => {
    if (!timezoneOptions.value.some(o => o.value === tz)) {
        timezoneOptions.value.unshift({ value: tz, label: `🕒 ${tz} (Your device)` })
    }
}

// (Note) USelect binds directly to the timezone string using items with value/label.

// Helper function to get current time in user's timezone
const getCurrentUserTime = () => {
    try {
        const now = new Date()
        return now.toLocaleString('en-US', {
            timeZone: preferences.value.timezone,
            hour: '2-digit',
            minute: '2-digit',
            hour12: true,
            weekday: 'short'
        })
    } catch (error) {
        console.error('Error getting user time:', error)
        return 'Invalid timezone'
    }
}

// Custom threshold state
const customThresholdValue = ref(5)

// Computed properties
const isCustomThreshold = computed(() => {
    return !thresholdOptions.some(option => option.value === preferences.value.cardDueThreshold)
})

// Threshold selection methods
const selectThreshold = (value: number) => {
    preferences.value.cardDueThreshold = value
    updatePreferences()
}

const selectCustomThreshold = () => {
    preferences.value.cardDueThreshold = customThresholdValue.value
    updatePreferences()
}

const updateCustomThreshold = () => {
    preferences.value.cardDueThreshold = customThresholdValue.value
    updatePreferences()
}

// Reactive preferences state
const preferences = ref<NotificationPreferences>({
    cardDueEnabled: true,
    cardDueTime: "09:00",
    cardDueThreshold: 5,
    dailyReminderEnabled: false,
    dailyReminderTime: "19:00",
    timezone: "UTC",
    quietHoursEnabled: false,
    quietHoursStart: "22:00",
    quietHoursEnd: "08:00",
    sendAnytimeOutsideQuietHours: false,
    activeHoursEnabled: false,
    activeHoursStart: "09:00",
    activeHoursEnd: "21:00"
})

// Load preferences on mount
onMounted(async () => {
    await loadPreferences()
    // After loading server preferences, detect browser timezone and apply sensible defaults
    try {
        const tz = Intl.DateTimeFormat().resolvedOptions().timeZone
        if (tz) {
            ensureTimezoneInOptions(tz)
            // If server has no timezone or it's the generic UTC, default to user's device timezone
            if (!preferences.value.timezone || preferences.value.timezone === 'UTC') {
                preferences.value.timezone = tz
                // Persist the detected timezone (debounced)
                updatePreferences()
            }
        }
    } catch (e) {
        console.warn('Could not detect browser timezone:', e)
    }
})

// Load preferences from API
const loadPreferences = async () => {
    try {
        loading.value = true
        const { data } = await $fetch('/api/notifications/preferences')

        if (data) {
            preferences.value = { ...preferences.value, ...data }
            // Initialize custom threshold value
            if (isCustomThreshold.value) {
                customThresholdValue.value = preferences.value.cardDueThreshold
            }
            // Make sure the current preference timezone appears in the list
            if (preferences.value.timezone) {
                ensureTimezoneInOptions(preferences.value.timezone)
            }
        }
    } catch (error) {
        console.error('Failed to load notification preferences:', error)
        toast.add({
            title: 'Error',
            description: 'Failed to load notification preferences',
            color: 'error'
        })
    } finally {
        loading.value = false
    }
}

// Debounced update function
const updatePreferences = useDebounceFn(async () => {
    try {
        loading.value = true

        await $fetch('/api/notifications/preferences', {
            method: 'PUT',
            body: preferences.value
        })

        lastSaved.value = new Date()

        toast.add({
            title: 'Settings Saved',
            description: 'Your notification preferences have been updated',
            color: 'success'
        })
    } catch (error) {
        console.error('Failed to update notification preferences:', error)
        toast.add({
            title: 'Error',
            description: 'Failed to save notification preferences',
            color: 'error'
        })
    } finally {
        loading.value = false
    }
}, 1000) // 1 second debounce

// Format relative time helper
const formatRelativeTime = (date: Date) => {
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    const seconds = Math.floor(diff / 1000)

    if (seconds < 60) return 'just now'
    if (seconds < 3600) return `${Math.floor(seconds / 60)} minutes ago`
    if (seconds < 86400) return `${Math.floor(seconds / 3600)} hours ago`
    return `${Math.floor(seconds / 86400)} days ago`
}
</script>

<template>
    <div class="max-w-4xl mx-auto p-6 space-y-6">
        <!-- Header -->
        <div class="flex items-center gap-3 mb-6">
            <UIcon name="i-heroicons-cog-6-tooth" class="w-8 h-8 text-gray-600 dark:text-gray-300" />
            <div>
                <h1 class="text-3xl font-bold text-gray-900 dark:text-gray-100">
                    Settings
                </h1>
                <p class="text-gray-600 dark:text-gray-400">
                    Manage your account preferences and application settings
                </p>
            </div>
        </div>

        <!-- Navigation Tabs -->
        <div class="border-b border-gray-200 dark:border-gray-700">
            <nav class="-mb-px flex space-x-8">
                <button v-for="(tab, index) in tabs" :key="tab.key" :class="[
                    'flex items-center gap-2 py-2 px-1 border-b-2 font-medium text-sm transition-colors',
                    selectedTab === index
                        ? 'border-primary-500 text-primary-600 dark:text-primary-400'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
                ]" @click="selectedTab = index">
                    <UIcon :name="tab.icon" class="w-4 h-4" />
                    {{ tab.label }}
                </button>
            </nav>
        </div>

        <!-- Tab Content -->
        <div class="py-6">
            <!-- Account Settings -->
            <div v-if="currentTab?.key === 'account'" class="space-y-6">
                <UCard>
                    <template #header>
                        <h3 class="text-lg font-semibold">Account Information</h3>
                    </template>
                    <div class="space-y-4">
                        <UFormGroup label="Email">
                            <UInput disabled :value="userEmail" />
                        </UFormGroup>
                        <UFormGroup label="Account Created">
                            <UInput disabled :value="formatDate(accountCreated)" />
                        </UFormGroup>
                    </div>
                </UCard>
            </div>

            <!-- Notifications -->
            <div v-if="currentTab?.key === 'notifications'">
                <SettingsNotificationPreferences />
            </div>

            <!-- Study Settings -->
            <div v-if="currentTab?.key === 'study'" class="space-y-6">
                <UCard>
                    <template #header>
                        <h3 class="text-lg font-semibold">Study Preferences</h3>
                    </template>
                    <div class="space-y-4">
                        <UFormGroup label="Default Cards per Session"
                            help="How many cards to review in a single session">
                            <UInput v-model.number="studySettings.defaultSessionSize" type="number" min="5" max="100"
                                placeholder="20" />
                        </UFormGroup>

                        <UFormGroup label="Auto-advance after grading"
                            help="Automatically move to next card after grading">
                            <UToggle v-model="studySettings.autoAdvance" />
                        </UFormGroup>

                        <UFormGroup label="Show answer immediately" help="Reveal answer without requiring a click">
                            <UToggle v-model="studySettings.showAnswerImmediately" />
                        </UFormGroup>
                    </div>
                </UCard>
            </div>

            <!-- Security -->
            <div v-if="currentTab?.key === 'security'" class="space-y-6">
                <UCard>
                    <template #header>
                        <h3 class="text-lg font-semibold">Security Settings</h3>
                    </template>
                    <div class="space-y-4">
                        <UButton color="primary" variant="outline">
                            Change Password
                        </UButton>
                        <UButton color="error" variant="outline">
                            Delete Account
                        </UButton>
                    </div>
                </UCard>
            </div>

            <!-- Data & Privacy -->
            <div v-if="currentTab?.key === 'data'" class="space-y-6">
                <UCard>
                    <template #header>
                        <h3 class="text-lg font-semibold">Data Management</h3>
                    </template>
                    <div class="space-y-4">
                        <UButton color="primary" variant="outline">
                            Export My Data
                        </UButton>
                        <UButton color="primary" variant="outline">
                            Import Data
                        </UButton>
                    </div>
                </UCard>

                <UCard>
                    <template #header>
                        <h3 class="text-lg font-semibold">Privacy Settings</h3>
                    </template>
                    <div class="space-y-4">
                        <UFormGroup label="Analytics" help="Help improve the app by sharing anonymous usage data">
                            <UToggle v-model="privacySettings.analytics" />
                        </UFormGroup>

                        <UFormGroup label="Error Reporting" help="Automatically report errors to help fix bugs">
                            <UToggle v-model="privacySettings.errorReporting" />
                        </UFormGroup>
                    </div>
                </UCard>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
// Page meta
definePageMeta({
    title: 'Settings',
    middleware: 'auth'
})

// Tab configuration
const selectedTab = ref(0)
const tabs = [
    {
        key: 'account',
        label: 'Account',
        icon: 'i-heroicons-user'
    },
    {
        key: 'notifications',
        label: 'Notifications',
        icon: 'i-heroicons-bell'
    },
    {
        key: 'study',
        label: 'Study',
        icon: 'i-heroicons-academic-cap'
    },
    {
        key: 'security',
        label: 'Security',
        icon: 'i-heroicons-shield-check'
    },
    {
        key: 'data',
        label: 'Data & Privacy',
        icon: 'i-heroicons-document-text'
    }
]

// Computed current tab
const currentTab = computed(() => tabs[selectedTab.value])

// User data (mock for now)
const userEmail = ref('user@example.com')
const accountCreated = ref(new Date('2024-01-15'))

// Study settings
const studySettings = ref({
    defaultSessionSize: 20,
    autoAdvance: true,
    showAnswerImmediately: false
})

// Privacy settings
const privacySettings = ref({
    analytics: true,
    errorReporting: true
})

// Utility functions
const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    }).format(date)
}

// Load user settings on mount
onMounted(async () => {
    // TODO: Load actual user data and settings from API
    // await loadUserSettings()
})
</script>

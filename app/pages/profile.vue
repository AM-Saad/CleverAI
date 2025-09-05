<template>
    <div class="container mx-auto px-4 py-8">
        <h1 class="text-3xl font-bold mb-8">My Profile</h1>

        <div v-if="status === 'authenticated'" class="grid md:grid-cols-3 gap-8">
            <!-- User Profile Card -->
            <div class="col-span-1">
                <div class="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
                    <div class="flex flex-col items-center mb-4">
                        <div
                            class="w-24 h-24 rounded-full bg-primary flex items-center justify-center text-white text-2xl mb-4">
                            {{ userInitials }}
                        </div>
                        <h2 class="text-xl font-semibold">{{ profileData?.name || 'User' }}</h2>
                        <p class="text-gray-500 dark:text-gray-400">{{ profileData?.email }}</p>
                        <p class="text-sm mt-2">{{ profileData?.role || 'USER' }}</p>
                    </div>

                    <div class="border-t dark:border-gray-700 pt-4 mt-4">
                        <div class="flex justify-between py-2">
                            <span class="text-gray-600 dark:text-gray-400">Account Created</span>
                            <span>{{ formattedCreatedDate }}</span>
                        </div>
                        <div class="flex justify-between py-2">
                            <span class="text-gray-600 dark:text-gray-400">Phone</span>
                            <span>{{ profileData?.phone || 'Not provided' }}</span>
                        </div>
                        <div class="flex justify-between py-2">
                            <span class="text-gray-600 dark:text-gray-400">Gender</span>
                            <span>{{ profileData?.gender || 'Not specified' }}</span>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Subscription Information -->
            <div class="md:col-span-2">
                <div class="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 mb-6">
                    <h3 class="text-xl font-semibold mb-4">Subscription</h3>

                    <div class="mb-6">
                        <div class="flex items-center justify-between mb-2">
                            <span class="text-gray-600 dark:text-gray-400">Current Plan</span>
                            <span
:class="{
                                'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300': subscriptionInfo.tier === 'PRO',
                                'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300': subscriptionInfo.tier === 'FREE',
                                'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300': subscriptionInfo.tier === 'ENTERPRISE'
                            }" class="px-3 py-1 rounded-full text-xs font-semibold">
                                {{ subscriptionInfo.tier }}
                            </span>
                        </div>

                        <div v-if="subscriptionInfo.tier === 'FREE'" class="mt-4">
                            <button class="btn bg-primary text-white w-full" @click="navigateToUpgrade">Upgrade to
                                Pro</button>
                        </div>
                    </div>

                    <!-- Usage Stats -->
                    <div class="mt-6">
                        <h4 class="font-medium text-lg mb-3">Usage This Period</h4>

                        <div class="mb-2 flex justify-between">
                            <span class="text-gray-600 dark:text-gray-400">AI Generations</span>
                            <span>{{ subscriptionInfo.generationsUsed }} / {{ subscriptionInfo.generationsQuota
                            }}</span>
                        </div>

                        <div class="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5">
                            <div
class="h-2.5 rounded-full bg-primary" :style="{ width: `${usagePercentage}%` }"
                                :class="{ 'bg-red-500': usagePercentage > 90 }"/>
                        </div>

                        <p class="text-sm mt-2 text-gray-500 dark:text-gray-400">
                            <span v-if="subscriptionInfo.remaining > 0">
                                {{ subscriptionInfo.remaining }} generations remaining
                            </span>
                            <span v-else class="text-red-500">
                                Quota exceeded
                            </span>
                        </p>
                    </div>
                </div>

                <!-- Account Settings -->
                <div class="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
                    <h3 class="text-xl font-semibold mb-4">Account Settings</h3>

                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <button
                            class="btn border border-gray-300 dark:border-gray-700 bg-transparent hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-800 dark:text-gray-200 w-full">
                            Change Password
                        </button>

                        <button
                            class="btn border border-gray-300 dark:border-gray-700 bg-transparent hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-800 dark:text-gray-200 w-full">
                            Update Profile
                        </button>

                        <button
                            class="btn border border-gray-300 dark:border-gray-700 bg-transparent hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-800 dark:text-gray-200 w-full">
                            Notification Settings
                        </button>

                        <button
                            class="btn border border-red-300 dark:border-red-700 bg-transparent hover:bg-red-50 dark:hover:bg-red-900 text-red-500 dark:text-red-400 w-full">
                            Delete Account
                        </button>
                    </div>
                </div>
            </div>

            <!-- LLM Usage Statistics -->
            <div class="col-span-3 mt-6">
                <div class="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
                    <h3 class="text-xl font-semibold mb-4">AI Usage Statistics (Last 30 Days)</h3>

                    <div v-if="isLlmUsageLoading" class="flex justify-center items-center py-12">
                        <div class="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary" />
                    </div>

                    <div v-else-if="llmUsageError" class="text-center py-8">
                        <p class="text-red-500">{{ llmUsageError }}</p>
                        <button class="mt-4 btn bg-primary text-white" @click="fetchLlmUsage">
                            Try Again
                        </button>
                    </div>

                    <div v-else-if="llmUsage">
                        <!-- Usage Summary -->
                        <div class="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
                            <div class="bg-gray-50 dark:bg-gray-900 p-4 rounded-lg">
                                <p class="text-gray-500 dark:text-gray-400 text-sm">Total AI Calls</p>
                                <p class="text-2xl font-bold">{{ llmUsage.summary.totalCalls }}</p>
                            </div>
                            <div class="bg-gray-50 dark:bg-gray-900 p-4 rounded-lg">
                                <p class="text-gray-500 dark:text-gray-400 text-sm">Total Tokens</p>
                                <p class="text-2xl font-bold">{{ formatNumber(llmUsage.summary.totalTokens) }}</p>
                            </div>
                            <div class="bg-gray-50 dark:bg-gray-900 p-4 rounded-lg">
                                <p class="text-gray-500 dark:text-gray-400 text-sm">Input Tokens</p>
                                <p class="text-2xl font-bold">{{ formatNumber(llmUsage.summary.totalPromptTokens) }}</p>
                            </div>
                            <div class="bg-gray-50 dark:bg-gray-900 p-4 rounded-lg">
                                <p class="text-gray-500 dark:text-gray-400 text-sm">Output Tokens</p>
                                <p class="text-2xl font-bold">{{ formatNumber(llmUsage.summary.totalCompletionTokens) }}
                                </p>
                            </div>
                        </div>

                        <!-- Usage by Feature -->
                        <div class="mb-8">
                            <h4 class="font-medium text-lg mb-3">Usage by Feature</h4>
                            <div class="overflow-x-auto">
                                <table class="w-full text-left">
                                    <thead>
                                        <tr class="border-b dark:border-gray-700">
                                            <th class="pb-2">Feature</th>
                                            <th class="pb-2 text-right">Calls</th>
                                            <th class="pb-2 text-right">Tokens</th>
                                            <th class="pb-2 text-right">Cost (USD)</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        <tr
v-for="feature in llmUsage.byFeature" :key="feature.name"
                                            class="border-b dark:border-gray-700">
                                            <td class="py-2">{{ feature.name }}</td>
                                            <td class="py-2 text-right">{{ feature.calls }}</td>
                                            <td class="py-2 text-right">{{ formatNumber(feature.tokens) }}</td>
                                            <td class="py-2 text-right">${{ feature.usd.toFixed(4) }}</td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        <!-- Usage by Model -->
                        <div class="mb-8">
                            <h4 class="font-medium text-lg mb-3">Usage by Model</h4>
                            <div class="overflow-x-auto">
                                <table class="w-full text-left">
                                    <thead>
                                        <tr class="border-b dark:border-gray-700">
                                            <th class="pb-2">Model</th>
                                            <th class="pb-2 text-right">Calls</th>
                                            <th class="pb-2 text-right">Tokens</th>
                                            <th class="pb-2 text-right">Cost (USD)</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        <tr
v-for="model in llmUsage.byModel" :key="model.name"
                                            class="border-b dark:border-gray-700">
                                            <td class="py-2">{{ model.name }}</td>
                                            <td class="py-2 text-right">{{ model.calls }}</td>
                                            <td class="py-2 text-right">{{ formatNumber(model.tokens) }}</td>
                                            <td class="py-2 text-right">${{ model.usd.toFixed(4) }}</td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        <!-- Recent Usage -->
                        <div>
                            <h4 class="font-medium text-lg mb-3">Recent Usage</h4>
                            <div class="overflow-x-auto">
                                <table class="w-full text-left">
                                    <thead>
                                        <tr class="border-b dark:border-gray-700">
                                            <th class="pb-2">Date</th>
                                            <th class="pb-2">Feature</th>
                                            <th class="pb-2">Model</th>
                                            <th class="pb-2 text-right">Tokens</th>
                                            <th class="pb-2 text-right">Cost (USD)</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        <tr
v-for="usage in llmUsage.recentUsage" :key="usage.id"
                                            class="border-b dark:border-gray-700">
                                            <td class="py-2">{{ formatDate(usage.date) }}</td>
                                            <td class="py-2">{{ usage.feature }}</td>
                                            <td class="py-2">{{ usage.model }}</td>
                                            <td class="py-2 text-right">{{ formatNumber(usage.tokens) }}</td>
                                            <td class="py-2 text-right">${{ usage.usd.toFixed(6) }}</td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>

                    <div v-else class="text-center py-8 text-gray-500">
                        <p>No AI usage data available.</p>
                    </div>
                </div>
            </div>
        </div>

        <!-- Loading or Unauthenticated State -->
        <div v-else-if="status === 'loading'" class="flex justify-center items-center min-h-[400px]">
            <div class="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary" />
        </div>

        <div v-else class="flex flex-col items-center justify-center min-h-[400px]">
            <p class="text-xl mb-4">Please sign in to view your profile</p>
            <button class="btn bg-primary text-white" @click="navigateToLogin">Sign In</button>
        </div>
    </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import type { SubscriptionInfo } from '~/composables/shared/useSubscription'
import { useSubscription } from '~/composables/shared/useSubscription'

interface UserProfile {
    id: string
    name: string
    email: string
    phone: string
    gender?: string
    role: string
    createdAt: string
    updatedAt: string
    subscription: SubscriptionInfo
}

interface LlmUsageSummary {
    totalCalls: number
    totalPromptTokens: number
    totalCompletionTokens: number
    totalTokens: number
    totalUsd: number
    periodStart: string
    periodEnd: string
}

interface LlmUsageItem {
    name: string
    calls: number
    tokens: number
    usd: number
}

interface LlmUsageEntry {
    id: string
    date: string
    feature: string
    model: string
    tokens: number
    usd: number
}

interface LlmUsageData {
    summary: LlmUsageSummary
    byFeature: LlmUsageItem[]
    byModel: LlmUsageItem[]
    dailyUsage: {
        date: string
        calls: number
        tokens: number
        usd: number
    }[]
    recentUsage: LlmUsageEntry[]
}

// Use auth composable to get user data
const { status, data } = useAuth()
const router = useRouter()

// Get subscription info
const { subscriptionInfo } = useSubscription()

// Create profile data ref
const profileData = ref<UserProfile | null>(null)
const isProfileLoading = ref(false)
const profileError = ref<string | null>(null)

// Create LLM usage data ref
const llmUsage = ref<LlmUsageData | null>(null)
const isLlmUsageLoading = ref(false)
const llmUsageError = ref<string | null>(null)

// Utility functions for formatting
const formatNumber = (num: number | null | undefined): string => {
    if (num === null || num === undefined) return '0'
    return new Intl.NumberFormat().format(num)
}

const formatDate = (dateStr: string): string => {
    return new Date(dateStr).toLocaleString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    })
}

// Calculate user initials for avatar
const userInitials = computed(() => {
    const name = profileData.value?.name || data.value?.user?.name || ''
    return name
        .split(' ')
        .map(part => part.charAt(0).toUpperCase())
        .slice(0, 2)
        .join('')
})

// Format creation date
const formattedCreatedDate = computed(() => {
    if (profileData.value?.createdAt) {
        return new Date(profileData.value.createdAt).toLocaleDateString()
    }
    return 'N/A'
})

// Calculate usage percentage for the progress bar
const usagePercentage = computed(() => {
    const { generationsUsed, generationsQuota } = subscriptionInfo.value
    if (generationsQuota === 0) return 0
    const percentage = (generationsUsed / generationsQuota) * 100
    return Math.min(percentage, 100) // Cap at 100%
})

// Navigation functions
const navigateToLogin = () => {
    router.push('/auth/signIn')
}

const navigateToUpgrade = () => {
    router.push('/upgrade')
}

// Function to fetch LLM usage data
const fetchLlmUsage = async () => {
    if (status.value !== 'authenticated') return

    isLlmUsageLoading.value = true
    llmUsageError.value = null

    try {
        const response = await $fetch<LlmUsageData>('/api/user/llm-usage', {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json'
            }
        })

        llmUsage.value = response
    } catch (err: unknown) {
        console.error('Error fetching LLM usage data:', err)
        if (err && typeof err === 'object' && 'data' in err &&
            err.data && typeof err.data === 'object' && 'message' in err.data &&
            typeof err.data.message === 'string') {
            llmUsageError.value = err.data.message
        } else {
            llmUsageError.value = 'Failed to load LLM usage data'
        }
    } finally {
        isLlmUsageLoading.value = false
    }
}

// Fetch user profile and LLM usage data on component mount
onMounted(async () => {
    if (status.value === 'authenticated') {
        // Fetch profile data
        isProfileLoading.value = true
        profileError.value = null

        try {
            const response = await $fetch<UserProfile>('/api/user/profile', {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json'
                }
            })

            // Update profile data
            profileData.value = response

            // Update subscription info
            if (response.subscription) {
                subscriptionInfo.value = response.subscription
            }

        } catch (err: unknown) {
            console.error('Error fetching user profile:', err)
            if (err && typeof err === 'object' && 'data' in err &&
                err.data && typeof err.data === 'object' && 'message' in err.data &&
                typeof err.data.message === 'string') {
                profileError.value = err.data.message
            } else {
                profileError.value = 'Failed to load profile data'
            }
        } finally {
            isProfileLoading.value = false
        }

        // Fetch LLM usage data
        await fetchLlmUsage()
    }
})
</script>

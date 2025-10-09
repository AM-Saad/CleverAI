<template>
    <div class="">
        <UiTitle tag="h1">My Profile</UiTitle>

        <div v-if="status === 'authenticated'" class="grid md:grid-cols-3 gap-8 mt-4">
            <!-- User Profile Card -->
            <div class="md:col-span-1">
                <UiCard variant="outline">
                    <div class="flex flex-col items-center mb-4">
                        <div
                            class="w-24 h-24 rounded-full bg-primary flex items-center justify-center text-white text-2xl mb-4">
                            {{ userInitials }}
                        </div>
                        <UiTitle>
                            {{ profileData?.name || 'User' }}
                        </UiTitle>
                        <UiParagraph>
                            {{ profileData?.email }}
                        </UiParagraph>
                    </div>

                    <div class="border-t dark:border-gray-700 pt-4 mt-4">
                        <UiParagraph class="flex justify-between py-2">
                            <span>
                                Account Created
                            </span>
                            <span>{{ formattedCreatedDate }}</span>
                        </UiParagraph>
                        <UiParagraph class="flex justify-between py-2">
                            <span>Phone</span>
                            <span>{{ profileData?.phone || 'Not provided' }}</span>
                        </UiParagraph>
                        <UiParagraph class="flex justify-between py-2">
                            <span>Gender</span>
                            <span class="capitalize">{{ profileData?.gender || 'Not specified' }}</span>
                        </UiParagraph>
                    </div>
                </UiCard>
            </div>

            <!-- Subscription Information -->
            <div class="md:col-span-2 space-y-4">
                <UiCard variant="outline">
                    <UiSubtitle>Subscription</UiSubtitle>

                    <div class="mb-6">
                        <div class="flex items-center justify-between mb-2">
                            <UiParagraph>
                                Current Plan
                            </UiParagraph>
                            <span :class="{
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
                        <UiSubtitle>
                            Usage This Period
                        </UiSubtitle>

                        <div class="mb-2 flex justify-between">
                            <span class="text-gray-600 dark:text-gray-400">AI Generations</span>
                            <span>{{ subscriptionInfo.generationsUsed }} / {{ subscriptionInfo.generationsQuota
                                }}</span>
                        </div>

                        <div class="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5">
                            <div class="h-2.5 rounded-full bg-primary" :style="{ width: `${usagePercentage}%` }"
                                :class="{ 'bg-red-500': usagePercentage > 90 }" />
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
                </UiCard>

                <!-- Account Settings -->
                <UiCard variant="outline">
                    <UiSubtitle>Account Settings</UiSubtitle>

                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                        <UButton size="sm">
                            Change Password
                        </UButton>

                        <UButton size="sm">
                            Update Profile
                        </UButton>

                        <UButton size="sm">
                            Notification Settings
                        </UButton>

                        <UButton size="sm" variant="outline" color="error">
                            Delete Account
                        </UButton>
                    </div>
                </UiCard>
            </div>

            <!-- LLM Usage Statistics -->
            <div class="md:col-span-3 mt-6">
                <UiCard>
                    <UiSubtitle>AI Usage Statistics (Last 30 Days)</UiSubtitle>
                    <div class="mt-4">
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
                                <UiCard>
                                    <UiSubtitle>
                                        Total AI Calls
                                    </UiSubtitle>
                                    <p>
                                        {{ llmUsage.summary.totalCalls }}
                                    </p>
                                </UiCard>
                                <UiCard>
                                    <UiSubtitle>Total Tokens</UiSubtitle>
                                    <p>{{ formatNumber(llmUsage.summary.totalTokens) }}</p>
                                </UiCard>
                                <UiCard>
                                    <UiSubtitle>Input Tokens</UiSubtitle>
                                    <p>{{ formatNumber(llmUsage.summary.totalPromptTokens) }}</p>
                                </UiCard>
                                <UiCard>
                                    <UiSubtitle>Output Tokens</UiSubtitle>
                                    <p>{{ formatNumber(llmUsage.summary.totalCompletionTokens) }}</p>
                                </UiCard>
                            </div>

                            <!-- Usage by Feature -->
                            <div class="mb-8">
                                <UiSubtitle>Usage by Feature</UiSubtitle>
                                <div class="overflow-x-auto mt-4 p-sm bg-muted  border-muted rounded">
                                    <table class="w-full text-left">
                                        <thead>
                                            <tr class="border-b dark:border-gray-700 ">
                                                <th class="py-1">Feature</th>
                                                <th class="py-1">Calls</th>
                                                <th class="py-1">Tokens</th>
                                                <th class="py-1 text-right">Cost (USD)</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            <tr v-for="(feature, idx) in llmUsage.byFeature" :key="feature.name"
                                                :class="`${idx !== llmUsage.byFeature.length - 1 ? 'border-b dark:border-gray-700' : ''}`">
                                                <td class="py-2">{{ feature.name }}</td>
                                                <td class="py-2">{{ feature.calls }}</td>
                                                <td class="py-2">{{ formatNumber(feature.tokens) }}</td>
                                                <td class="py-2 text-right">${{ feature.usd.toFixed(4) }}</td>
                                            </tr>
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            <!-- Usage by Model -->
                            <div class="mb-8">
                                <UiSubtitle>Usage by Model</UiSubtitle>
                                <div class="overflow-x-auto mt-4 p-sm bg-muted border-muted rounded">
                                    <table class="w-full text-left">
                                        <thead>
                                            <tr class="border-b dark:border-gray-700">
                                                <th class="pb-2">Model</th>
                                                <th class="pb-2">Calls</th>
                                                <th class="pb-2">Tokens</th>
                                                <th class="pb-2 text-right">Cost (USD)</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            <tr v-for="(model, idx) in llmUsage.byModel" :key="model.name"
                                                :class="`${idx !== llmUsage.byModel.length - 1 ? 'border-b dark:border-gray-700' : ''}`">
                                                <td class="py-2">{{ model.name }}</td>
                                                <td class="py-2">{{ model.calls }}</td>
                                                <td class="py-2">{{ formatNumber(model.tokens) }}</td>
                                                <td class="py-2 text-right">${{ model.usd.toFixed(4) }}</td>
                                            </tr>
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            <!-- Recent Usage -->
                            <div>
                                <UiSubtitle>Recent Usage</UiSubtitle>
                                <div class="overflow-x-auto mt-4 p-sm bg-muted border-muted rounded">
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
                                            <tr v-for="(usage, idx) in llmUsage.recentUsage" :key="usage.id"
                                                :class="`${idx !== llmUsage.recentUsage.length - 1 ? 'border-b dark:border-gray-700' : ''}`">
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
                </UiCard>
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
import UiParagraph from '~/components/ui/UiParagraph.vue'
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

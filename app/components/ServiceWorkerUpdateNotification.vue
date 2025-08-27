<template>
    <div v-if="updateAvailable" class="update-banner">
        <!-- Slide-down notification banner -->
        <Transition enter-active-class="transition-all duration-300 ease-out"
            enter-from-class="transform -translate-y-full opacity-0"
            enter-to-class="transform translate-y-0 opacity-100"
            leave-active-class="transition-all duration-300 ease-in"
            leave-from-class="transform translate-y-0 opacity-100"
            leave-to-class="transform -translate-y-full opacity-0">
            <div v-if="showBanner"
                class="fixed top-0 left-0 right-0 z-50 bg-gradient-to-r from-blue-500 to-purple-600 text-white shadow-lg">
                <div class="container mx-auto px-4 py-3">
                    <div class="flex items-center justify-between">
                        <div class="flex items-center space-x-3">
                            <!-- Update icon -->
                            <div class="flex-shrink-0">
                                <Icon v-if="isUpdating" name="heroicons:arrow-path" class="w-6 h-6 animate-spin" />
                                <Icon v-else name="heroicons:sparkles" class="w-6 h-6" />
                            </div>

                            <!-- Message -->
                            <div>
                                <h3 class="font-semibold text-sm">
                                    {{ isUpdating ? 'Updating App...' : 'New Version Available!' }}
                                </h3>
                                <p class="text-xs opacity-90">
                                    {{ isUpdating
                                        ? 'Please wait while we update the app...'
                                        : 'Get the latest features and improvements.'
                                    }}
                                </p>
                            </div>
                        </div>

                        <!-- Actions -->
                        <div v-if="!isUpdating" class="flex items-center space-x-2">
                            <UButton size="xs" variant="solid" color="primary" :loading="isUpdating"
                                @click="handleUpdate">
                                Update Now
                            </UButton>

                            <UButton size="xs" variant="ghost" color="neutral" @click="handleDismiss">
                                Later
                            </UButton>
                        </div>

                        <!-- Loading indicator -->
                        <div v-if="isUpdating" class="flex items-center space-x-2">
                            <div class="animate-pulse text-xs">Updating...</div>
                            <div class="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        </div>
                    </div>

                    <!-- Progress bar -->
                    <div v-if="isUpdating" class="mt-2">
                        <div class="w-full bg-white/20 rounded-full h-1">
                            <div class="bg-white h-1 rounded-full animate-pulse" style="width: 60%" />
                        </div>
                    </div>
                </div>
            </div>
        </Transition>

        <!-- Modal for important updates -->
        <UModal v-model="showModal" :prevent-close="isUpdating">
            <div class="p-6">
                <div class="flex items-center space-x-3 mb-4">
                    <div class="flex-shrink-0">
                        <Icon v-if="isUpdating" name="heroicons:arrow-path"
                            class="w-8 h-8 text-blue-500 animate-spin" />
                        <Icon v-else name="heroicons:sparkles" class="w-8 h-8 text-blue-500" />
                    </div>
                    <div>
                        <h3 class="text-lg font-semibold">
                            {{ isUpdating ? 'Updating CleverAI...' : 'Update Available' }}
                        </h3>
                        <p class="text-sm text-gray-600">
                            {{ isUpdating
                                ? 'Please wait while we install the latest version.'
                                : 'A new version of CleverAI is ready to install.'
                            }}
                        </p>
                    </div>
                </div>

                <!-- Update details -->
                <div v-if="!isUpdating" class="mb-6 p-4 bg-blue-50 rounded-lg">
                    <h4 class="font-medium text-blue-900 mb-2">What's New:</h4>
                    <ul class="text-sm text-blue-800 space-y-1">
                        <li>• Fixed notification click navigation</li>
                        <li>• Improved service worker reliability</li>
                        <li>• Enhanced performance and stability</li>
                    </ul>
                </div>

                <!-- Progress -->
                <div v-if="isUpdating" class="mb-6">
                    <div class="flex justify-between text-sm mb-2">
                        <span>Installing update...</span>
                        <span>{{ refreshing ? '100%' : '60%' }}</span>
                    </div>
                    <div class="w-full bg-gray-200 rounded-full h-2">
                        <div class="bg-blue-500 h-2 rounded-full transition-all duration-500"
                            :style="{ width: refreshing ? '100%' : '60%' }" />
                    </div>
                </div>

                <!-- Error message -->
                <div v-if="updateError" class="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                    <p class="text-sm text-red-700">{{ updateError }}</p>
                </div>

                <!-- Actions -->
                <div v-if="!isUpdating" class="flex justify-end space-x-3">
                    <UButton variant="outline" :disabled="isUpdating" @click="handleDismiss">
                        Update Later
                    </UButton>
                    <UButton :loading="isUpdating" @click="handleUpdate">
                        Install Update
                    </UButton>
                </div>

                <div v-if="refreshing" class="text-center text-sm text-gray-600">
                    The app will refresh automatically...
                </div>
            </div>
        </UModal>
    </div>
</template>

<script setup lang="ts">
interface Props {
    mode?: 'banner' | 'modal' | 'auto'
    autoShow?: boolean
}

const props = withDefaults(defineProps<Props>(), {
    mode: 'auto',
    autoShow: true
})

const {
    updateAvailable,
    isUpdating,
    updateError,
    refreshing,
    applyUpdate,
    dismissUpdate
} = useServiceWorkerUpdates()

const showBanner = ref(false)
const showModal = ref(false)

// Show notification based on mode
watch(updateAvailable, (available) => {
    console.log('🔔 ServiceWorkerUpdateNotification: updateAvailable changed to:', available)
    console.log('🔔 ServiceWorkerUpdateNotification: props.autoShow:', props.autoShow)
    console.log('🔔 ServiceWorkerUpdateNotification: props.mode:', props.mode)

    if (available && props.autoShow) {
        if (props.mode === 'banner' || props.mode === 'auto') {
            console.log('🔔 ServiceWorkerUpdateNotification: Showing banner')
            showBanner.value = true
            // Auto-hide banner after 10 seconds if user doesn't interact
            setTimeout(() => {
                if (showBanner.value && !isUpdating.value) {
                    console.log('🔔 ServiceWorkerUpdateNotification: Auto-hiding banner')
                    showBanner.value = false
                }
            }, 10000)
        }

        if (props.mode === 'modal') {
            console.log('🔔 ServiceWorkerUpdateNotification: Showing modal')
            showModal.value = true
        }
    } else {
        console.log('🔔 ServiceWorkerUpdateNotification: Not showing (available:', available, 'autoShow:', props.autoShow, ')')
    }
}, { immediate: true })

// Handle update button click
const handleUpdate = async () => {
    showBanner.value = false
    showModal.value = false
    await applyUpdate()
}

// Handle dismiss button click
const handleDismiss = () => {
    showBanner.value = false
    showModal.value = false
    dismissUpdate()
}

// Show modal for critical updates (could be triggered by server)
const showCriticalUpdate = () => {
    showModal.value = true
}

// Expose methods for parent components
defineExpose({
    showCriticalUpdate,
    showBanner: () => { showBanner.value = true },
    showModal: () => { showModal.value = true }
})
</script>

<style scoped>
.update-banner {
    position: relative;
    z-index: 1000;
}
</style>

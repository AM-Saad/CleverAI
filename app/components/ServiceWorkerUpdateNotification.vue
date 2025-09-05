<template>
    <!-- Update Notification Banner/Modal -->
    <div v-if="updateAvailable || showDebugPanel" class="sw-update-system">
        <!-- Slide-down notification banner -->
        <Transition enter-active-class="transition-all duration-300 ease-out"
            enter-from-class="transform -translate-y-full opacity-0"
            enter-to-class="transform translate-y-0 opacity-100"
            leave-active-class="transition-all duration-300 ease-in"
            leave-from-class="transform translate-y-0 opacity-100"
            leave-to-class="transform -translate-y-full opacity-0">
            <div v-if="showBanner && updateAvailable"
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
                                        : `Get the latest features and improvements${version ? ` (v${version})` : ''}.`
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
                                : `A new version of CleverAI is ready to install${version ? ` (v${version})` : ''}.`
                            }}
                        </p>
                    </div>
                </div>

                <!-- Service Worker Status (when in debug mode) -->
                <div v-if="showDebugPanel && !isUpdating" class="mb-4 p-4 bg-gray-50 rounded-lg">
                    <h4 class="font-medium text-gray-900 mb-2 flex items-center gap-2">
                        <Icon name="heroicons:cog-6-tooth" class="w-4 h-4" />
                        Service Worker Status
                    </h4>
                    <div class="grid grid-cols-2 gap-4 text-sm">
                        <div class="space-y-1">
                            <div>Controlling: <strong>{{ isControlling ? 'Yes' : 'No' }}</strong></div>
                            <div>Version: <strong>{{ version || 'Unknown' }}</strong></div>
                            <div>Network: <strong>{{ isOnline ? 'Online' : 'Offline' }}</strong></div>
                        </div>
                        <div class="space-y-1">
                            <div>Updates: <strong>{{ updateAvailable ? 'Available' : 'None' }}</strong></div>
                            <div>Uploads: <strong>{{ Object.keys(uploads).length }}</strong></div>
                            <div>Sync: <strong>{{ formSyncStatus || 'Idle' }}</strong></div>
                        </div>
                    </div>
                </div>

                <!-- File Upload Progress -->
                <div v-if="Object.keys(uploads).length && showDebugPanel" class="mb-4 p-4 bg-blue-50 rounded-lg">
                    <h4 class="font-medium text-blue-900 mb-2 flex items-center gap-2">
                        <Icon name="heroicons:arrow-up-tray" class="w-4 h-4" />
                        File Uploads ({{ Object.keys(uploads).length }})
                    </h4>
                    <div class="space-y-2 max-h-32 overflow-auto">
                        <div v-for="(upload, id) in uploads" :key="id" class="bg-white rounded p-2">
                            <div class="flex justify-between items-center mb-1">
                                <span class="text-xs font-mono truncate">{{ id }}</span>
                                <span class="text-xs" :class="upload.done ? 'text-green-600' : 'text-blue-600'">
                                    {{ upload.done ? 'Complete' : 'Uploading' }}
                                </span>
                            </div>
                            <div class="w-full bg-gray-200 rounded-full h-1.5">
                                <div class="bg-blue-500 h-1.5 rounded-full transition-all"
                                    :style="{ width: ((upload.index + 1) / upload.totalChunks * 100) + '%' }" />
                            </div>
                            <div class="flex justify-between text-xs text-gray-500 mt-1">
                                <span>{{ upload.index + 1 }} / {{ upload.totalChunks }}</span>
                                <span>{{ Math.round((upload.index + 1) / upload.totalChunks * 100) }}%</span>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Update details -->
                <div v-if="!isUpdating && updateAvailable" class="mb-6 p-4 bg-blue-50 rounded-lg">
                    <h4 class="font-medium text-blue-900 mb-2">What's New:</h4>
                    <ul class="text-sm text-blue-800 space-y-1">
                        <li>• Fixed notification click navigation</li>
                        <li>• Improved service worker reliability</li>
                        <li>• Enhanced performance and stability</li>
                        <li>• Better offline functionality</li>
                        <li>• Optimized caching strategies</li>
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
                <div v-if="updateError || lastError" class="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                    <div class="flex items-center gap-2 mb-1">
                        <Icon name="heroicons:exclamation-triangle" class="w-4 h-4 text-red-500" />
                        <span class="font-medium text-red-700">Error</span>
                    </div>
                    <p class="text-sm text-red-700">{{ updateError || lastError }}</p>
                </div>

                <!-- Debug Controls (Development Mode) -->
                <div v-if="showDebugPanel && isDev" class="mb-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                    <h4 class="font-medium text-yellow-900 mb-2 flex items-center gap-2">
                        <Icon name="heroicons:wrench-screwdriver" class="w-4 h-4" />
                        Debug Controls
                    </h4>
                    <div class="flex flex-wrap gap-2">
                        <UButton size="xs" @click="forceServiceWorkerUpdate" variant="outline">
                            Force SW Update
                        </UButton>
                        <UButton size="xs" @click="forceServiceWorkerControl" variant="outline">
                            Claim Control
                        </UButton>
                        <UButton size="xs" @click="simulateUpdateAvailable" variant="outline">
                            Simulate Update
                        </UButton>
                        <UButton size="xs" @click="debugServiceWorker" variant="outline">
                            Debug SW
                        </UButton>
                        <UButton size="xs" @click="manualRefresh" variant="outline">
                            Manual Refresh
                        </UButton>
                        <UButton size="xs" @click="resetUpdateState" variant="outline" color="error">
                            Reset State
                        </UButton>
                    </div>
                </div>

                <!-- Actions -->
                <div v-if="!isUpdating" class="flex justify-between items-center">
                    <div class="flex items-center gap-2">
                        <UButton v-if="isDev" size="xs" variant="ghost" @click="toggleDebugPanel">
                            {{ showDebugPanel ? 'Hide Debug' : 'Show Debug' }}
                        </UButton>
                    </div>

                    <div class="flex space-x-3">
                        <UButton variant="outline" :disabled="isUpdating" @click="handleDismiss">
                            {{ updateAvailable ? 'Update Later' : 'Close' }}
                        </UButton>
                        <UButton v-if="updateAvailable" :loading="isUpdating" @click="handleUpdate">
                            Install Update
                        </UButton>
                    </div>
                </div>

                <div v-if="refreshing" class="text-center text-sm text-gray-600">
                    The app will refresh automatically...
                </div>
            </div>
        </UModal>
    </div>

    <!-- Debug Panel (Fixed Position) -->
    <Transition enter-active-class="transition-all duration-300 ease-out"
        enter-from-class="transform translate-y-full opacity-0" enter-to-class="transform translate-y-0 opacity-100"
        leave-active-class="transition-all duration-300 ease-in" leave-from-class="transform translate-y-0 opacity-100"
        leave-to-class="transform translate-y-full opacity-0">
        <div v-if="showDebugPanel && isDev" class="sw-debug-panel">
            <div
                class="bg-white/95 dark:bg-gray-900/95 backdrop-blur border rounded-lg p-4 text-sm space-y-3 shadow-lg">
                <header class="flex items-center justify-between">
                    <h3 class="font-semibold flex items-center gap-2">
                        <Icon name="heroicons:cloud" class="w-4 h-4 text-blue-500" />
                        Service Worker
                    </h3>
                    <div class="flex items-center gap-2">
                        <UBadge :color="updateAvailable ? 'warning' : (isControlling ? 'success' : 'neutral')"
                            variant="subtle" size="xs">
                            {{ updateAvailable ? 'Update' : (isControlling ? 'Active' : 'Inactive') }}
                        </UBadge>
                        <UBadge v-if="version" color="neutral" variant="outline" size="xs">
                            v{{ version }}
                        </UBadge>
                        <UButton size="xs" variant="ghost" @click="toggleDebugPanel">
                            <Icon name="heroicons:x-mark" class="w-3 h-3" />
                        </UButton>
                    </div>
                </header>

                <section class="grid grid-cols-2 gap-3 text-xs">
                    <div>
                        <p class="font-medium mb-1">Status</p>
                        <ul class="space-y-0.5">
                            <li>Controlling: <strong>{{ isControlling ? 'Yes' : 'No' }}</strong></li>
                            <li>Network: <strong>{{ isOnline ? 'Online' : 'Offline' }}</strong></li>
                            <li>Updates: <strong>{{ updateAvailable ? 'Available' : 'None' }}</strong></li>
                        </ul>
                    </div>
                    <div>
                        <p class="font-medium mb-1">Activity</p>
                        <ul class="space-y-0.5">
                            <li>Uploads: <strong>{{ Object.keys(uploads).length }}</strong></li>
                            <li>Sync: <strong>{{ formSyncStatus || 'Idle' }}</strong></li>
                            <li>Version: <strong>{{ version || 'Unknown' }}</strong></li>
                        </ul>
                    </div>
                </section>

                <section v-if="Object.keys(uploads).length" class="space-y-2">
                    <p class="font-medium text-xs">Active Uploads</p>
                    <div class="space-y-1 max-h-24 overflow-auto">
                        <div v-for="(upload, id) in uploads" :key="id" class="flex items-center justify-between">
                            <span class="text-xs font-mono truncate flex-1">{{ String(id).slice(-8) }}</span>
                            <span class="text-xs ml-2" :class="upload.done ? 'text-green-600' : 'text-blue-600'">
                                {{ Math.round((upload.index + 1) / upload.totalChunks * 100) }}%
                            </span>
                        </div>
                    </div>
                </section>

                <footer class="flex items-center justify-between pt-2 border-t text-xs text-gray-500">
                    <button @click="showModal = true" class="underline hover:text-gray-700">
                        Open Panel
                    </button>
                    <button @click="toggleCollapsed" class="underline hover:text-gray-700">
                        {{ collapsed ? 'Expand' : 'Collapse' }}
                    </button>
                </footer>
            </div>
        </div>
    </Transition>
</template>

<script setup lang="ts">
interface Props {
    mode?: 'banner' | 'modal' | 'auto'
    autoShow?: boolean
    enableDebugPanel?: boolean
}

const props = withDefaults(defineProps<Props>(), {
    mode: 'auto',
    autoShow: true,
    enableDebugPanel: false
})

// Combine both composables for comprehensive functionality
const {
    updateAvailable,
    isUpdating,
    updateError,
    refreshing,
    applyUpdate,
    dismissUpdate,
    // Dev mode functions
    forceServiceWorkerUpdate,
    forceServiceWorkerControl,
    manualRefresh,
    debugServiceWorker,
    simulateUpdateAvailable,
    resetUpdateState
} = useServiceWorkerUpdates()

const {
    version,
    isControlling,
    uploads,
    lastError,
    formSyncStatus
} = useServiceWorkerBridge()

// Network status
const { isOnline } = useNetworkStatus()

// Local state
const showBanner = ref(false)
const showModal = ref(false)
const showDebugPanel = ref(props.enableDebugPanel)
const collapsed = ref(false)

// Development mode detection
const isDev = import.meta.dev

// Show notification based on mode
watch(updateAvailable, (available) => {
    console.log('🔔 ServiceWorkerUpdateNotification: updateAvailable changed to:', available)
    console.log('🔔 ServiceWorkerUpdateNotification: props.autoShow:', props.autoShow)
    console.log('🔔 ServiceWorkerUpdateNotification: props.mode:', props.mode)

    if (available && props.autoShow) {
        if (props.mode === 'banner' || props.mode === 'auto') {
            console.log('🔔 ServiceWorkerUpdateNotification: Showing banner')
            showBanner.value = true
            // Auto-hide banner after 15 seconds if user doesn't interact
            setTimeout(() => {
                if (showBanner.value && !isUpdating.value) {
                    console.log('🔔 ServiceWorkerUpdateNotification: Auto-hiding banner')
                    showBanner.value = false
                }
            }, 15000)
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

// Debug panel controls
const toggleDebugPanel = () => {
    showDebugPanel.value = !showDebugPanel.value
}

const toggleCollapsed = () => {
    collapsed.value = !collapsed.value
}

// Show modal for critical updates (could be triggered by server)
const showCriticalUpdate = () => {
    showModal.value = true
}

// Global keyboard shortcuts (development only)
if (isDev) {
    const handleKeydown = (event: KeyboardEvent) => {
        // Ctrl/Cmd + Shift + D = Toggle debug panel
        if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key === 'D') {
            event.preventDefault()
            toggleDebugPanel()
        }

        // Ctrl/Cmd + Shift + U = Force update
        if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key === 'U') {
            event.preventDefault()
            if (updateAvailable.value) {
                handleUpdate()
            } else {
                simulateUpdateAvailable?.()
            }
        }

        // Ctrl/Cmd + Shift + R = Force refresh
        if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key === 'R') {
            event.preventDefault()
            manualRefresh?.()
        }
    }

    onMounted(() => {
        document.addEventListener('keydown', handleKeydown)
    })

    onUnmounted(() => {
        document.removeEventListener('keydown', handleKeydown)
    })
}

// Expose methods for parent components
defineExpose({
    showCriticalUpdate,
    showBanner: () => { showBanner.value = true },
    showModal: () => { showModal.value = true },
    toggleDebugPanel,
    resetUpdateState,
    simulateUpdateAvailable
})

// Watch for errors and show them in the debug panel
watch([updateError, lastError], ([uErr, lErr]) => {
    if ((uErr || lErr) && isDev) {
        console.error('🔴 Service Worker Error:', uErr || lErr)
        // Auto-show debug panel on errors in development
        if (!showDebugPanel.value) {
            showDebugPanel.value = true
        }
    }
})

// Auto-collapse debug panel based on collapsed state
watch(collapsed, (isCollapsed) => {
    if (import.meta.client) {
        nextTick(() => {
            const panel = document.querySelector('.sw-debug-panel') as HTMLElement
            if (panel) {
                panel.style.maxHeight = isCollapsed ? '3rem' : '400px'
                panel.style.overflow = isCollapsed ? 'hidden' : 'auto'
            }
        })
    }
})

// Log component lifecycle for debugging
onMounted(() => {
    console.log('🔄 ServiceWorkerUpdateNotification mounted')
    if (isDev) {
        console.log('🔍 Development shortcuts:')
        console.log('  Ctrl/Cmd + Shift + D: Toggle debug panel')
        console.log('  Ctrl/Cmd + Shift + U: Force update or simulate')
        console.log('  Ctrl/Cmd + Shift + R: Force refresh')
    }
})

onUnmounted(() => {
    console.log('🔄 ServiceWorkerUpdateNotification unmounted')
})
</script>

<style scoped>
.sw-update-system {
    position: relative;
    z-index: 1000;
}

.update-banner {
    position: relative;
    z-index: 1000;
}

.sw-debug-panel {
    position: fixed;
    bottom: 1rem;
    right: 1rem;
    width: 320px;
    z-index: 999;
    max-height: 400px;
    transition: all 0.3s ease;
}

.sw-debug-panel .bg-white\/95 {
    box-shadow: 0 4px 18px -2px rgba(0, 0, 0, 0.15);
}

/* Responsive adjustments */
@media (max-width: 640px) {
    .sw-debug-panel {
        left: 1rem;
        right: 1rem;
        width: auto;
        bottom: 0.5rem;
    }
}

/* Animation improvements */
.sw-debug-panel .transition-all {
    transition: all 0.2s ease;
}

/* Hover effects */
.sw-debug-panel:hover {
    box-shadow: 0 6px 24px -4px rgba(0, 0, 0, 0.2);
}

/* Badge customization */
.sw-debug-panel .badge {
    font-size: 0.75rem;
    padding: 0.25rem 0.5rem;
}

/* Progress bar improvements */
.progress-bar {
    background: linear-gradient(90deg, #3b82f6, #6366f1);
    animation: progress-shimmer 2s ease-in-out infinite;
}

@keyframes progress-shimmer {

    0%,
    100% {
        opacity: 1;
    }

    50% {
        opacity: 0.8;
    }
}

/* Upload progress styling */
.upload-progress {
    background: linear-gradient(90deg, #10b981, #059669);
    transition: width 0.3s ease;
}

/* Error state */
.error-banner {
    background: linear-gradient(90deg, #ef4444, #dc2626);
}

/* Success state */
.success-banner {
    background: linear-gradient(90deg, #10b981, #059669);
}

/* Modal backdrop blur */
.modal-backdrop {
    backdrop-filter: blur(4px);
    background: rgba(0, 0, 0, 0.3);
}

/* Debug panel collapsed state */
.sw-debug-panel.collapsed {
    max-height: 3rem;
    overflow: hidden;
}

.sw-debug-panel.collapsed .space-y-3>*:not(:first-child) {
    display: none;
}

/* Notification pulse effect */
.notification-pulse {
    animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
}

@keyframes pulse {

    0%,
    100% {
        opacity: 1;
    }

    50% {
        opacity: .8;
    }
}

/* Status indicators */
.status-online {
    color: #10b981;
}

.status-offline {
    color: #ef4444;
}

.status-updating {
    color: #f59e0b;
}

/* Smooth transitions for all interactive elements */
button,
.badge,
.progress-bar {
    transition: all 0.2s ease;
}

/* Focus states for accessibility */
button:focus {
    outline: 2px solid #3b82f6;
    outline-offset: 2px;
}

/* Dark mode specific adjustments */
@media (prefers-color-scheme: dark) {
    .sw-debug-panel .bg-gray-50 {
        background: rgba(31, 41, 55, 0.9);
    }

    .sw-debug-panel .text-gray-900 {
        color: rgb(243, 244, 246);
    }

    .sw-debug-panel .border {
        border-color: rgba(75, 85, 99, 0.3);
    }
}
</style>

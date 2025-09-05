<template>
    <div class="container mx-auto px-4 py-8">
        <div class="max-w-4xl mx-auto">
            <h1 class="text-3xl font-bold mb-8">Enhanced Service Worker Update Notification Test</h1>

            <!-- Test Controls -->
            <div class="bg-white rounded-lg shadow p-6 mb-8">
                <h2 class="text-xl font-semibold mb-4">Test Controls</h2>
                <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <UButton size="sm" @click="swNotification?.showBanner()">
                        Show Banner
                    </UButton>
                    <UButton size="sm" @click="swNotification?.showModal()">
                        Show Modal
                    </UButton>
                    <UButton size="sm" @click="swNotification?.toggleDebugPanel()">
                        Toggle Debug
                    </UButton>
                    <UButton size="sm" @click="swNotification?.simulateUpdateAvailable()">
                        Simulate Update
                    </UButton>
                    <UButton size="sm" color="error" @click="swNotification?.resetUpdateState()">
                        Reset State
                    </UButton>
                    <UButton size="sm" variant="outline" @click="refreshPage">
                        Refresh Page
                    </UButton>
                </div>
            </div>

            <!-- Component Instance -->
            <div class="bg-gray-50 rounded-lg p-6">
                <h3 class="text-lg font-semibold mb-4">Enhanced Component</h3>
                <p class="text-gray-600 mb-4">
                    This enhanced component combines update notifications with debugging capabilities.
                    In development mode, you can use keyboard shortcuts:
                </p>
                <ul class="text-sm text-gray-500 mb-6 space-y-1">
                    <li><kbd class="bg-gray-200 px-1 rounded">Ctrl/Cmd + Shift + D</kbd> - Toggle debug panel</li>
                    <li><kbd class="bg-gray-200 px-1 rounded">Ctrl/Cmd + Shift + U</kbd> - Force update or simulate</li>
                    <li><kbd class="bg-gray-200 px-1 rounded">Ctrl/Cmd + Shift + R</kbd> - Force refresh</li>
                </ul>

                <!-- The enhanced component -->
                <ServiceWorkerUpdateNotification ref="swNotification" mode="auto" :auto-show="true"
                    :enable-debug-panel="true" />
            </div>

            <!-- Feature Showcase -->
            <div class="mt-8 grid md:grid-cols-2 gap-6">
                <div class="bg-blue-50 rounded-lg p-6">
                    <h3 class="text-lg font-semibold text-blue-900 mb-3">✨ Enhanced Features</h3>
                    <ul class="text-blue-800 space-y-2 text-sm">
                        <li>• Combined update notifications and debug panel</li>
                        <li>• Service worker status monitoring</li>
                        <li>• File upload progress tracking</li>
                        <li>• Network status indication</li>
                        <li>• Development keyboard shortcuts</li>
                        <li>• Error handling and display</li>
                        <li>• Responsive design</li>
                    </ul>
                </div>

                <div class="bg-green-50 rounded-lg p-6">
                    <h3 class="text-lg font-semibold text-green-900 mb-3">🎯 User Experience</h3>
                    <ul class="text-green-800 space-y-2 text-sm">
                        <li>• Banner notifications for updates</li>
                        <li>• Modal for critical updates</li>
                        <li>• Progress indicators</li>
                        <li>• Auto-hide functionality</li>
                        <li>• Smooth animations</li>
                        <li>• Accessibility support</li>
                        <li>• Dark mode compatible</li>
                    </ul>
                </div>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
const swNotification = ref()

const refreshPage = () => {
    window.location.reload()
}

// Set page title
useHead({
    title: 'Enhanced Service Worker Test - CleverAI'
})
</script>

<style scoped>
kbd {
    font-family: monospace;
    font-size: 0.875rem;
    padding: 0.125rem 0.25rem;
    border-radius: 0.25rem;
    background: #f3f4f6;
    border: 1px solid #d1d5db;
}
</style>

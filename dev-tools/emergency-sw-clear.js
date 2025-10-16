// Emergency service worker unregistration script
// Run this in browser console to clear all service workers

async function clearAllServiceWorkers() {
    try {
        console.log('🧹 Clearing all service workers...')

        const registrations = await navigator.serviceWorker.getRegistrations()
        console.log('Found', registrations.length, 'service worker registrations')

        for (const registration of registrations) {
            console.log('Unregistering:', registration.scope)
            await registration.unregister()
            console.log('✅ Unregistered')
        }

        console.log('🧹 All service workers cleared')
        console.log('🔄 Refreshing page...')
        window.location.reload()

    } catch (error) {
        console.error('❌ Error clearing service workers:', error)
    }
}

console.log('🧹 Emergency cleanup script loaded')
console.log('Run clearAllServiceWorkers() to clear all service workers and refresh')

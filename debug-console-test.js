// Console test script for notification clicks
// Run this in browser developer tools

console.log('🔔 Starting notification click test...')

async function testNotificationClick() {
    try {
        // Check if service worker is ready
        const registration = await navigator.serviceWorker.ready
        console.log('✅ Service worker ready:', registration)

        // Check if notification permission is granted
        if (Notification.permission !== 'granted') {
            console.error('❌ Notification permission not granted')
            const permission = await Notification.requestPermission()
            if (permission !== 'granted') {
                console.error('❌ Permission denied')
                return
            }
        }

        console.log('✅ Notification permission granted')

        // Show a test notification
        await registration.showNotification('Click Test', {
            body: 'Click this notification to test navigation',
            icon: '/icons/192x192.png',
            tag: 'click-test',
            data: {
                url: '/about',
                timestamp: Date.now()
            }
        })

        console.log('✅ Test notification shown')
        console.log('👆 Click the notification to test navigation')

    } catch (error) {
        console.error('❌ Error:', error)
    }
}

// Test service worker message passing
async function testMessagePassing() {
    try {
        if (!navigator.serviceWorker.controller) {
            console.error('❌ No service worker controller')
            return
        }

        console.log('✅ Service worker controller found')

        // Send test message
        navigator.serviceWorker.controller.postMessage({
            type: 'TEST_NOTIFICATION_CLICK',
            data: { url: '/about' }
        })

        console.log('✅ Test message sent to service worker')

    } catch (error) {
        console.error('❌ Error:', error)
    }
}

// Add message listener to see responses
navigator.serviceWorker.addEventListener('message', (event) => {
    console.log('📨 Message from service worker:', event.data)
})

console.log('🔔 Test functions ready:')
console.log('- testNotificationClick() - Shows a test notification')
console.log('- testMessagePassing() - Tests direct message to service worker')
console.log('')
console.log('Run testNotificationClick() first, then click the notification')

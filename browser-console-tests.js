// Quick Browser Console Tests for Spaced Repetition System

// 1. Test Keyboard Shortcuts
console.log("Testing keyboard shortcuts...");
['a', '?', ' ', '1', '2', '3', '4', '5', '6', 's', 'Escape', 'ArrowLeft', 'ArrowRight'].forEach(key => {
    setTimeout(() => {
        console.log(`Testing key: ${key}`);
        document.dispatchEvent(new KeyboardEvent('keydown', { key }));
    }, 1000);
});

// 2. Test Analytics API (requires authentication)
fetch('/api/review/analytics')
    .then(response => response.json())
    .then(data => console.log('Analytics data:', data))
    .catch(error => console.error('Analytics error:', error));

// 3. Test Audio Context
if (window.AudioContext || window.webkitAudioContext) {
    console.log("✅ Audio context supported");
} else {
    console.log("❌ Audio context not supported");
}

// 4. Test Local Storage
try {
    localStorage.setItem('test', 'value');
    localStorage.removeItem('test');
    console.log("✅ Local storage working");
} catch (error) {
    console.log("❌ Local storage error:", error);
}

// 5. Test Vue DevTools Detection
if (window.__VUE_DEVTOOLS_GLOBAL_HOOK__) {
    console.log("✅ Vue DevTools detected");
} else {
    console.log("⚠️ Vue DevTools not detected");
}

// 6. Test Performance
console.time('PageLoad');
window.addEventListener('load', () => {
    console.timeEnd('PageLoad');
});

// 7. Test Responsive Design
function testResponsive() {
    const sizes = [
        { width: 320, height: 568, name: 'Mobile Portrait' },
        { width: 768, height: 1024, name: 'Tablet Portrait' },
        { width: 1024, height: 768, name: 'Tablet Landscape' },
        { width: 1920, height: 1080, name: 'Desktop' }
    ];

    sizes.forEach(size => {
        console.log(`Testing ${size.name}: ${size.width}x${size.height}`);
        // Note: This is for manual testing - actual window resizing needs to be done manually
    });
}

// 8. Test Network Status
navigator.onLine ?
    console.log("✅ Online") :
    console.log("❌ Offline");

// 9. Test Modern Browser Features
const features = {
    'Intersection Observer': 'IntersectionObserver' in window,
    'Fetch API': 'fetch' in window,
    'Local Storage': 'localStorage' in window,
    'Session Storage': 'sessionStorage' in window,
    'Geolocation': 'geolocation' in navigator,
    'WebGL': !!document.createElement('canvas').getContext('webgl'),
    'Service Worker': 'serviceWorker' in navigator
};

console.log("Browser Feature Support:");
Object.entries(features).forEach(([feature, supported]) => {
    console.log(`${supported ? '✅' : '❌'} ${feature}`);
});

console.log("🧪 All tests queued. Check console output and test manually!");

# 🛠️ Development Tools

This folder contains development and debugging utilities for the CleverAI PWA system.

## 📁 Files

### Debug Scripts
- **`debug-console-test.js`** - Browser console script for testing notifications
- **`emergency-sw-clear.js`** - Emergency service worker cleanup script
- **`test-custom-sw.js`** - Playwright test for service worker functionality

### Debug HTML Pages
- **`debug-notification-clicks.html`** - Test page for notification click handling
- **`debug-subscription.html`** - Test page for push notification subscriptions
- **`test-notification.html`** - General notification testing page

## 🚀 Usage

### Testing Notifications in Browser
1. Open browser developer tools console
2. Copy and paste contents of `debug-console-test.js`
3. Run `testNotificationClick()` or `testMessagePassing()`

### Emergency SW Cleanup
If service worker gets stuck:
1. Open browser developer tools console
2. Copy and paste contents of `emergency-sw-clear.js`
3. Run `clearAllServiceWorkers()`

### Automated Testing
```bash
# Run the Playwright test
node dev-tools/test-custom-sw.js
```

## ⚠️ Important
These tools are for **development only**. Do not include in production builds.

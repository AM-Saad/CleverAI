# 🛠️ Development Tools

This workspace contains development and debugging utilities for the Cognilo PWA system.

## 📁 Files

### Debug Scripts
- **`debug-console-test.js`** - Browser console script for testing notifications
- **`emergency-sw-clear.js`** - Emergency service worker cleanup script
- **`test-custom-sw.js`** - Playwright test for service worker functionality

### Debug Dashboard
- **Centralized Debug Dashboard** - Visit `/debug` for comprehensive testing interface
  - ✅ Notification testing (permission, direct notifications, API tests)
  - ✅ Service Worker management (status, debug mode, updates)
  - ✅ Cron & timing gates (trigger tests, cooldown clearing, gate bypass)
  - ✅ Live logging system with real-time monitoring

### Legacy Debug Files (Archived)
- **`debug-notification-clicks.html`** - ⚠️ **Moved to debug-archive/** (use `/debug` instead)
- **`debug-subscription.html`** - ⚠️ **Moved to debug-archive/** (use `/debug` instead)
- **`test-notification.html`** - ⚠️ **Moved to debug-archive/** (use `/debug` instead)

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

# 📁 Debug Archive

This folder contains legacy debug files that have been **consolidated into the centralized debug dashboard at `/debug`**.

## 🗃️ Archived Files

### Root-level HTML files
- `debug-cron-notifications.html` - Originally in `/public/`
- `debug.html` - Originally in `/public/`
- `notification-flow-checker.html` - Originally in root `/`
- `test-notification-modal.html` - Originally in root `/`

### Dev-tools HTML files
- `debug-notification-clicks.html` - Originally in `/dev-tools/`
- `debug-subscription.html` - Originally in `/dev-tools/`
- `test-notification.html` - Originally in `/dev-tools/`

### Vue test pages (redundant)
- `test-notifications.vue` - Originally in `/app/pages/` - **100% redundant with `/debug`**

### Root-level debug scripts (standalone)
- `debug-notification-gates.js` - Browser console script for notification gates debugging
- `test-timing.ts` - Standalone timing function testing script
- `test-cron.js` - Manual cron manager testing script## ✅ Migration Status

**All functionality from these files has been consolidated into:**
- **Main Debug Dashboard**: `/debug` (Vue component at `/app/pages/debug.vue`)

**The centralized dashboard includes:**
- 🔔 Notification testing (permission, direct notifications, API tests)
- ⚙️ Service Worker management (status, debug mode, updates)
- 🕒 Cron task testing and timing gate controls
- 📝 Real-time logging and monitoring
- 📊 Operation result tracking

## 🚮 Cleanup Information

**Date Archived**: September 14, 2025
**Reason**: Consolidation to eliminate scattered debug files
**Replacement**: Use `/debug` for all debugging needs

**These files can be safely deleted after confirming the centralized debug dashboard works correctly.**

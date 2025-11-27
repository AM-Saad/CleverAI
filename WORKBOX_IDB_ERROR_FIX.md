# IndexedDB "Backing Store" Error - Fix Summary

## Problem
You were getting this error in the service worker:
```
Uncaught (in promise) UnknownError: Internal error opening backing store for indexedDB.open
```

## Root Cause
This error is **NOT from your application's IndexedDB** (`recwide_db`), but from **Workbox's internal IndexedDB** that it uses for precache metadata. This error typically occurs when:

1. **Browser is in Private/Incognito mode** - IndexedDB may be disabled
2. **Storage quota exceeded** - Browser storage is full
3. **Corrupted IndexedDB files** - Workbox's metadata DB is corrupted
4. **Browser storage restrictions** - User has disabled storage in settings
5. **Multiple tabs conflict** - Concurrent access causing locks
6. **Firefox-specific issues** - Known IDB implementation bugs

## Solutions Implemented

### 1. **Service Worker Error Suppression** (`sw-src/index.ts`)
- Added global `unhandledrejection` listener to catch and suppress Workbox IDB errors
- Prevents console spam while still logging the error
- Notifies clients once about storage issues

```typescript
self.addEventListener('unhandledrejection', (event: PromiseRejectionEvent) => {
    if (event.reason?.message?.includes('backing store') || 
        event.reason?.message?.includes('indexedDB.open')) {
        error('Workbox IDB error (non-fatal):', event.reason.message)
        event.preventDefault() // Prevent console spam
        notifyClientsOfStorageIssue()
        return
    }
})
```

### 2. **Graceful Workbox Failure** (`sw-src/index.ts`)
- Wrapped Workbox precache in try-catch
- Service worker continues to function even if precaching fails

```typescript
try {
    precacheAndRoute(manifest, { ignoreURLParametersMatching: [/^utm_/, /^fbclid$/] })
    cleanupOutdatedCaches()
} catch (e) {
    error('Workbox precache failed (continuing without precache):', e)
}
```

### 3. **Client-Side Toast Notifications** (`app/plugins/sw-messages.client.ts`)
- Shows user-friendly warning when storage issues are detected
- Provides action button to navigate to fix page
- Prevents duplicate notifications

### 4. **Storage Cleanup Page** (`app/pages/debug-clear.vue`)
- New page at `/debug-clear` to help users fix storage issues
- Two options:
  - **Clear Everything**: All IndexedDB, caches, SW, localStorage
  - **Clear Workbox Only**: Just Workbox databases and caches
- Shows detailed progress of what was cleared

## How to Use

### For End Users:
1. If you see a warning toast about storage issues, click **"Fix Now"**
2. Or navigate to `/debug-clear` manually
3. Click **"Clear Workbox Only"** first (less destructive)
4. If that doesn't work, use **"Clear Everything"** 
5. Refresh the page

### For Developers:
1. The error is now suppressed in console (still logged once)
2. Service worker continues to work without precaching
3. Monitor for storage warnings in production
4. Consider adding storage quota monitoring

## Prevention

### Browser-Level:
- Don't use private/incognito mode for PWA features
- Ensure browser storage is enabled
- Close duplicate tabs running the same app
- Clear cache periodically if storage is limited

### Code-Level:
- Monitor storage quota with `navigator.storage.estimate()`
- Implement storage quota warnings before limits are hit
- Consider reducing cache sizes in production
- Add periodic cleanup of old caches

## Testing the Fix

1. **Build the updated SW:**
   ```bash
   yarn sw:build
   yarn build:inject
   ```

2. **Test in browser:**
   - Open DevTools → Application → Storage → IndexedDB
   - Delete all Workbox databases
   - Refresh page
   - Error should be suppressed and warning shown

3. **Test cleanup page:**
   - Navigate to `/debug-clear`
   - Click "Clear Workbox Only"
   - Verify toast shows success
   - Refresh and verify SW works

## What Changed

### Files Modified:
- `sw-src/index.ts` - Added error handling and suppression
- `app/plugins/sw-messages.client.ts` - NEW: SW message listener
- `app/pages/debug-clear.vue` - NEW: Storage cleanup utility

### Files Not Changed:
- `app/utils/idb.ts` - Your app's IDB code is fine
- `server/tasks/check-due-cards.ts` - Already fixed in previous commit

## Related Issues Fixed

1. **Prisma orphaned records** - Added cascade delete to schema
2. **Cron job errors** - Fixed null user filtering
3. **Workbox IDB errors** - This fix

## Next Steps

1. Deploy to production with new SW
2. Monitor for storage warnings in analytics
3. Consider adding `navigator.storage.estimate()` monitoring
4. Document `/debug-clear` page for support team

## Additional Notes

- The error is **non-fatal** - SW continues to work without precaching
- Workbox will retry IDB operations automatically
- Users can continue using the app even with this error
- Most common in Firefox and Safari with stricter storage policies

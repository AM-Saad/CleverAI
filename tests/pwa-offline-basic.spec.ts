import { test, expect } from '@playwright/test';

// Basic offline smoke test to ensure core shell loads when offline.
// Assumes build already completed and service worker registered on /.

test.describe('PWA offline basic', () => {
  test('should load an internal route offline after warmup', async ({ page, context, browserName }) => {
    test.skip(browserName !== 'chromium', 'Offline simulation stable only in Chromium for this test');

    await page.goto('/');
    // Wait for service worker registration
    await page.waitForTimeout(2000);

    // Navigate to a secondary route to warm caches (choose an existing route)
    await page.goto('/about');
    await expect(page).toHaveURL(/\/about$/);
    await expect(page.locator('body')).toBeVisible();

    // Go offline
    await context.setOffline(true);

    // Reload about page (should come from precache/runtime cache)
    await page.reload();
    await expect(page.locator('body')).toBeVisible();

    // Navigate back to home offline
    await page.goto('/');
    await expect(page.locator('body')).toBeVisible();

    // Restore online
    await context.setOffline(false);
  });
});

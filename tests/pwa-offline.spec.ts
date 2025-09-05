// tests/pwa-offline.spec.ts
import { test, expect } from '@playwright/test';

test.describe('PWA offline behavior', () => {
  test('renders app shell offline after warm-up', async ({ page, context, baseURL }) => {
    // 1) Online: open home and wait for the SW to be ready (registers + precaches)
    await page.goto('/', { waitUntil: 'load' });

    // Ensure service worker is active
    await page.waitForFunction(async () => {
      if (!('serviceWorker' in navigator)) return false;
      const reg = await navigator.serviceWorker.ready;
      return !!reg?.active;
    }, { timeout: 20_000 });

    // Warm a couple of routes/assets while online
    // Adjust these paths to real ones you use
    await page.goto('/about', { waitUntil: 'load' }).catch(() => {});
    await page.goto('/', { waitUntil: 'load' });

    // 2) Go offline
    await context.setOffline(true);

    // 3) Reload the app shell while offline — should still render from cache
    await page.reload({ waitUntil: 'domcontentloaded' });

    // Expect Nuxt root exists (shell rendered)
    const appRoot = page.locator('#__nuxt');
    await expect(appRoot).toBeVisible();

    // You can add a stronger assertion if your shell shows a known element:
    // await expect(page.getByRole('navigation')).toBeVisible();

    // 4) Navigate to a new URL while offline.
    // Depending on your fallback strategy, this might serve your app shell or offline page.
    await page.goto('/some-non-existent-route-xyz', { waitUntil: 'domcontentloaded' });

    // Still expect the shell (or your offline page) to render something meaningful (no network error)
    await expect(appRoot).toBeVisible();

    // Back online for next tests
    await context.setOffline(false);
  });

  test('serves the offline page offline', async ({ page, context }) => {
    // Make sure offline page is cached first (online)
    await page.goto('/offline', { waitUntil: 'load' });

    // Use a stable test id on your offline page root
    const marker = page.getByTestId('offline-page');

    // 2) Go offline
    await context.setOffline(true);

    // 3) Try to open /offline while offline — should load from cache
    await page.goto('/offline', { waitUntil: 'domcontentloaded' });

    // Assert something stable on your offline page:
    // Prefer a data-testid; otherwise assert some known text
    // Adjust to your actual offline.vue content:
    await expect(marker).toBeVisible();

    // Restore online
    await context.setOffline(false);
  });
});

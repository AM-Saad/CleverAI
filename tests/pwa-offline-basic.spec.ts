import { test, expect } from '@playwright/test';
import { CACHE_NAMES, SW_CONFIG } from '../app/utils/constants/pwa';

// Basic offline smoke test to ensure core shell loads when offline.
// Assumes build already completed and service worker registered on /.

test.describe('PWA offline basic', () => {
  test('production worker parses in Chromium', async ({ page, browserName }) => {
    test.skip(browserName !== 'chromium', 'Worker parser check runs in Chromium');
    await page.goto('/');
    const source = await page.evaluate(() => fetch('/sw.js', { cache: 'no-store' }).then((response) => response.text()));
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Runtime.enable');
    const result = await cdp.send('Runtime.compileScript', {
      expression: source,
      sourceURL: 'production-sw.js',
      persistScript: false,
    });
    await cdp.detach();
    expect(result.exceptionDetails).toBeUndefined();
  });

  test('can evaluate a minimal worker script', async ({ page, browserName }) => {
    test.skip(browserName !== 'chromium', 'Service-worker diagnostics run in Chromium');
    await page.goto('/');

    const registration = await page.evaluate(async () => {
      const registration = await navigator.serviceWorker.register('/test-minimal-worker.js', {
        scope: '/diagnostic/',
      });
      await new Promise<void>((resolve, reject) => {
        const candidate = registration.installing ?? registration.waiting ?? registration.active;
        if (!candidate || candidate.state === 'activated') {
          resolve();
          return;
        }
        candidate.addEventListener('statechange', () => {
          if (candidate.state === 'activated') resolve();
          if (candidate.state === 'redundant') reject(new Error('minimal worker became redundant'));
        });
      });
      return registration.active?.scriptURL ?? registration.waiting?.scriptURL ?? null;
    });

    expect(registration).toContain('/test-minimal-worker.js');
    await page.goto('/diagnostic/');
    await expect.poll(() => page.evaluate(() => navigator.serviceWorker.controller?.scriptURL ?? null)).toContain('/test-minimal-worker.js');
    await page.evaluate(() => navigator.serviceWorker.getRegistration('/diagnostic/').then((registration) => registration?.unregister()));
  });

  test('should load an internal route offline after warmup', async ({ page, context, browserName }) => {
    test.skip(browserName !== 'chromium', 'Offline simulation stable only in Chromium for this test');
    const workerMessages: string[] = [];
    await page.addInitScript(() => {
      (window as Window & { __swDiagnosticMessages?: unknown[] }).__swDiagnosticMessages = [];
      navigator.serviceWorker?.addEventListener('message', (event) => {
        (window as Window & { __swDiagnosticMessages?: unknown[] }).__swDiagnosticMessages?.push(event.data);
      });
    });
    context.on('serviceworker', (worker) => {
      worker.on('console', (message) => workerMessages.push(`[worker:${message.type()}] ${message.text()}`));
      worker.on('close', () => workerMessages.push('[worker] closed'));
    });
    context.on('weberror', (error) => workerMessages.push(`[web-error] ${error.stack}`));
    page.on('console', (message) => workerMessages.push(`[page:${message.type()}] ${message.text()}`));

    await page.goto('/');
    // Make first-install activation deterministic. Production intentionally
    // leaves ordinary updates waiting, but this isolated profile has no active
    // worker or user who can accept that update.
    await page.evaluate(async (syncProtocol) => {
      const registration = await navigator.serviceWorker.register(`/sw.js?syncProtocol=${encodeURIComponent(syncProtocol)}`);
      const installing = registration.installing;
      if (installing && installing.state === 'installing') {
        await new Promise<void>((resolve, reject) => {
          installing.addEventListener('statechange', () => {
            if (installing.state === 'installed' || installing.state === 'activated') resolve();
            if (installing.state === 'redundant') reject(new Error('production worker became redundant'));
          });
        });
      }
      const waiting = registration.waiting ?? (installing?.state === 'installed' ? installing : null);
      waiting?.postMessage({ type: 'SKIP_WAITING' });
      await navigator.serviceWorker.ready;
    }, SW_CONFIG.SYNC_PROTOCOL);
    await page.waitForLoadState('domcontentloaded');
    let hasController = false;
    try {
      hasController = await page.evaluate(() => Boolean(navigator.serviceWorker.controller));
    } catch {
      // A critical protocol activation deliberately reloads on controllerchange.
      await page.waitForLoadState('domcontentloaded');
      hasController = await page.evaluate(() => Boolean(navigator.serviceWorker.controller));
    }
    if (!hasController) {
      await page.reload();
    }
    // A precache can take longer than an arbitrary sleep on a cold install, so
    // poll outside the page execution context and tolerate activation reloads.
    await expect.poll(async () => {
      try {
        return await page.evaluate(() => navigator.serviceWorker.controller?.scriptURL ?? null);
      } catch {
        return null;
      }
    }, { timeout: 20_000 }).toContain('/sw.js');
    const serviceWorkerState = await page.evaluate(async () => {
      const registrations = await navigator.serviceWorker.getRegistrations();
      return {
        controller: navigator.serviceWorker.controller?.scriptURL ?? null,
        registrations: registrations.map((registration) => ({
          active: registration.active?.state ?? null,
          installing: registration.installing?.state ?? null,
          waiting: registration.waiting?.state ?? null,
        })),
      };
    });
    if (!serviceWorkerState.controller) {
      const diagnostics = await page.evaluate(() => (window as Window & { __swDiagnosticMessages?: unknown[] }).__swDiagnosticMessages ?? []);
      workerMessages.push(...diagnostics.map((diagnostic) => `[worker-diagnostic] ${JSON.stringify(diagnostic)}`));
      throw new Error(`Service worker did not control the page: ${JSON.stringify(serviceWorkerState)}\n${workerMessages.join('\n')}`);
    }
    expect(serviceWorkerState.controller).toContain('/sw.js');

    // The worker deliberately caches only the neutral root shell. Visit it
    // under active control and verify the write before testing another route.
    await page.goto('/');
    await expect.poll(() => page.evaluate(async (cacheName) => {
      const cache = await caches.open(cacheName);
      return Boolean(await cache.match('/', { ignoreSearch: true }));
    }, CACHE_NAMES.PAGES)).toBe(true);

    // Navigate to a secondary route after the neutral shell is durable.
    await page.goto('/about');
    await expect(page).toHaveURL(/\/about$/);
    await expect(page.locator('body')).toBeVisible();
    await expect.poll(() => page.evaluate(() => navigator.serviceWorker.controller?.scriptURL ?? null)).toContain('/sw.js');

    // Go offline
    await context.setOffline(true);
    await expect(page.getByText('No internet connection. Your changes are saved locally.', { exact: true })).toBeVisible();

    // Auth.js checks this endpoint during every cold start/window refresh.
    // Offline is a valid "no live session" state, not a server failure.
    const offlineSession = await page.evaluate(async () => {
      const response = await fetch('/api/auth/session', { cache: 'no-store' });
      return {
        status: response.status,
        body: await response.json(),
      };
    });
    expect(offlineSession).toEqual({ status: 200, body: {} });

    // Reload about page (should come from precache/runtime cache)
    await page.reload();
    await expect(page.locator('body')).toBeVisible();

    // Navigate back to home offline
    await page.goto('/');
    await expect(page.locator('body')).toBeVisible();

    // Restore online
    await context.setOffline(false);
    await expect(page.getByText('No internet connection. Your changes are saved locally.', { exact: true })).toBeHidden({ timeout: 10_000 });
  });
});

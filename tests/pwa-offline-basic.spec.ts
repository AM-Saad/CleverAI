import { test, expect } from '@playwright/test';

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
    // A precache can take longer than an arbitrary sleep on a cold install.
    // Require an active controller before we simulate disconnection; otherwise
    // this test only proves that a race can bypass the service worker.
    const serviceWorkerState = await page.evaluate(async () => {
      await Promise.race([
        navigator.serviceWorker.ready,
        new Promise((resolve) => window.setTimeout(resolve, 15_000)),
      ]);
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

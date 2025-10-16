// playwright.config.ts
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  timeout: 60_000,
  fullyParallel: true,
  reporter: [['list']],

  // Run your built app like production
  webServer: {
    command: 'yarn preview --port 8080',
    url: 'http://localhost:8080',
    reuseExistingServer: true,
    timeout: 60_000,
  },

  use: {
    baseURL: 'http://localhost:8080',
    trace: 'on-first-retry',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});

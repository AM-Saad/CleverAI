// playwright.config.ts
import { defineConfig, devices } from '@playwright/test';

const baseURL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:8080';

export default defineConfig({
  testDir: './tests',
  timeout: 60_000,
  fullyParallel: true,
  reporter: [['list']],

  // Run your built app like production
  webServer: process.env.PLAYWRIGHT_BASE_URL ? undefined : {
    command: 'yarn preview --port 8080',
    url: 'http://localhost:8080',
    reuseExistingServer: true,
    timeout: 60_000,
  },

  use: {
    baseURL,
    trace: 'on-first-retry',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});

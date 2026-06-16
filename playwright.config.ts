import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: 'http://127.0.0.1:5173',
    trace: 'retain-on-failure',
    screenshot: 'on',
    headless: true,
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        launchOptions: {
          args: ['--disable-gpu', '--no-sandbox', '--disable-setuid-sandbox']
        }
      },
    },
  ],
  webServer: [
    {
      command: 'pnpm --filter @workspace/api-server start',
      url: 'http://127.0.0.1:8080/api/healthz',
      reuseExistingServer: true,
      env: {
        PORT: '8080',
        NODE_ENV: 'development',
        DATABASE_URL: 'file:../../database.db',
      },
      timeout: 30000,
    },
    {
      command: 'pnpm --filter @workspace/market-dashboard serve',
      url: 'http://127.0.0.1:5173',
      reuseExistingServer: true,
      env: {
        PORT: '5173',
      },
      timeout: 30000,
    }
  ],
});

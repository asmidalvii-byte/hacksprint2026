import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests/browser', fullyParallel: true, workers: 2,
  use: { baseURL: 'http://127.0.0.1:3100', headless: true, screenshot: 'only-on-failure' },
  webServer: { command: 'node server/index.js', url: 'http://127.0.0.1:3100', reuseExistingServer: false, env: { PORT: '3100', AI_ENABLED: 'false' } },
  reporter: 'list'
});

import { defineConfig } from '@playwright/test';
import path from 'node:path';

export default defineConfig({
  testDir: '.',
  testMatch: 'overview.spec.ts',
  fullyParallel: false,
  workers: 1,
  timeout: 90_000,
  outputDir: '../../test-results/local-overview',
  reporter: [['list']],
  use: { baseURL: 'http://127.0.0.1:3198', channel: 'chrome', trace: 'retain-on-failure', screenshot: 'only-on-failure', viewport: { width: 1440, height: 1000 } },
  webServer: { command: 'node scripts/serve-overview-review.mjs', cwd: path.resolve(__dirname, '../..'), url: 'http://127.0.0.1:3198/dashboard', reuseExistingServer: true, timeout: 45_000 },
});

import {defineConfig} from '@playwright/test';
// Provisional outer phase capacity; manifest budget review required before execution.
export default defineConfig({testDir:'.',testMatch:'save-bonus.spec.mjs',workers:1,retries:0,timeout:900_000,reporter:'list',outputDir:'../../test-results/save-bonus-playwright'});

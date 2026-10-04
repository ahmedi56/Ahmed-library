import { defineConfig } from '@playwright/test';

/**
 * Smoke tests: one pass over the things a visitor must be able to do,
 * run against the production build (`vite preview`), not the dev server —
 * so they catch what would actually ship.
 *
 * Uses the Microsoft Edge already installed on Windows (channel 'msedge')
 * instead of downloading Playwright's own browsers. SwiftShader gives the
 * headless browser software WebGL, so the 3D room really renders.
 *
 *   npm run test:e2e
 */
export default defineConfig({
  testDir: 'tests',
  timeout: 90_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  // One retry: the 3D tests render on the CPU (see tests/smoke.spec.ts),
  // and a momentarily busy machine can push a step past its timeout.
  retries: 1,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:4173',
    channel: 'msedge',
    headless: true,
    viewport: { width: 1280, height: 800 },
    launchOptions: { args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] },
  },
  webServer: {
    command: 'npm run build && npm run preview -- --port 4173 --strictPort',
    url: 'http://localhost:4173',
    reuseExistingServer: false,
    timeout: 180_000,
  },
});

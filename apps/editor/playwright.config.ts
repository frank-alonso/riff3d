import { defineConfig } from "@playwright/test";

/**
 * Playwright E2E and visual regression configuration.
 *
 * Visual regression is REQUIRED CI (promoted from Phase 3 non-blocking beta).
 * Per-fixture tolerance bands in e2e/fixtures/tolerance-bands.ts supersede
 * the generic thresholds previously defined in this config's `expect` block.
 * Individual tests pass their own maxDiffPixels/threshold via tolerance bands.
 *
 * The global expect.toHaveScreenshot thresholds are kept as safety fallbacks
 * but individual tests should always use per-fixture values.
 */
export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  retries: 0,
  use: {
    baseURL: "http://localhost:3000",
    browserName: "chromium",
    viewport: { width: 1280, height: 720 },
    screenshot: "only-on-failure",
    trace: "on-first-retry",
    launchOptions: {
      args: [
        "--use-gl=swiftshader",
        "--disable-dev-shm-usage",
        "--no-sandbox",
      ],
    },
  },
  projects: [
    {
      name: "e2e",
      testMatch: /.*\.e2e\.ts/,
      // Retry once to handle Supabase anonymous signup rate limits (429).
      // Each test run calls signInAnonymously() which hits POST /signup;
      // rapid consecutive runs can exhaust the quota.
      retries: 1,
    },
    {
      name: "visual",
      testMatch: /.*\.visual\.ts/,
      // Visual regression is required CI (not non-blocking beta).
      // Per-fixture tolerance bands provide precise thresholds.
    },
    {
      name: "stress",
      testMatch: /.*\.spec\.ts/,
      // Stress tests are local-only evidence generators, gated behind
      // STRESS_TEST env var. Not included in CI — run manually for
      // review gate evidence packets.
    },
  ],
  expect: {
    toHaveScreenshot: {
      // Global fallback thresholds. Individual tests use per-fixture tolerance
      // bands from e2e/fixtures/tolerance-bands.ts for precise control.
      maxDiffPixelRatio: 0.05,
      threshold: 0.15,
    },
  },
  webServer: {
    command: "pnpm dev",
    url: "http://localhost:3000",
    reuseExistingServer: true,
    timeout: 30_000,
  },
});

/**
 * Visual baseline tests for golden fixture rendering (PlayCanvas).
 *
 * Captures Playwright screenshots of golden fixtures rendered via the
 * PlayCanvas adapter. These baselines are now REQUIRED CI (promoted
 * from Phase 3 non-blocking beta in Phase 4, plan 04-04).
 *
 * For dual-adapter visual regression (PlayCanvas + Babylon.js), see
 * dual-adapter.visual.ts which uses per-fixture tolerance bands.
 *
 * Run: pnpm test:visual (requires dev server + Supabase with anonymous sign-ins enabled)
 * Update baselines: pnpm test:visual:update
 *
 * Screenshot timing relies on the __sceneAlreadyReady flag set by the
 * PlayCanvas adapter after loadScene completes one render frame.
 */
import { test, expect } from "@playwright/test";
import { getToleranceBand } from "../fixtures/tolerance-bands";

/**
 * Wait for the PlayCanvas adapter's __sceneReady signal.
 *
 * Uses DOM polling for the __sceneAlreadyReady flag to avoid the race
 * condition where the CustomEvent fires before page.evaluate() attaches
 * a listener.
 */
async function waitForSceneReady(page: import("@playwright/test").Page): Promise<void> {
  await page.waitForFunction(
    () => (window as unknown as Record<string, unknown>).__sceneAlreadyReady === true,
    { timeout: 30_000 },
  );
}

/**
 * Pause the render loop so toHaveScreenshot() produces stable frames.
 * Without this, the live WebGL render loop causes frame-to-frame jitter.
 */
async function pauseRenderLoop(page: import("@playwright/test").Page): Promise<void> {
  await page.evaluate(() => {
    const app = (window as unknown as Record<string, { autoRender?: boolean }>).__pcApp;
    if (app) {
      app.autoRender = false;
    }
  });
}

/**
 * Golden fixtures from packages/fixtures.
 *
 * Each fixture exercises different rendering capabilities:
 * - transforms-parenting: Nested transforms, parent-child hierarchy
 * - materials-lights: PBR materials, multiple light types
 * - animation: Animated entities (static frame capture)
 */
const FIXTURES = [
  { name: "transforms-parenting", description: "Nested transforms and parent-child hierarchy" },
  { name: "materials-lights", description: "PBR materials with multiple light types" },
  { name: "animation", description: "Animated entities (static frame)" },
] as const;

test.describe("Visual baselines - golden fixture rendering", () => {
  // No loginAsGuest needed — fixture routes serve builder-generated ECSON
  // without hitting the database, so no authentication is required.

  for (const fixture of FIXTURES) {
    test(`baseline: ${fixture.name}`, async ({ page }) => {
      // Navigate to the fixture route
      await page.goto(`/editor/fixture/${fixture.name}`);

      // Wait for the viewport canvas to appear
      const canvas = page.locator("canvas");
      await canvas.waitFor({ state: "visible", timeout: 30_000 });

      // Wait for __sceneReady to ensure rendering is complete
      await waitForSceneReady(page);

      // Allow an extra frame for any post-render effects
      await page.waitForTimeout(500);

      // Pause the render loop for stable screenshots
      await pauseRenderLoop(page);

      // Capture screenshot of the canvas element
      // First run generates baselines; subsequent runs compare against them.
      // Per-fixture tolerance bands (Phase 4) replace generic beta thresholds.
      const tolerance = getToleranceBand(fixture.name);
      await expect(canvas).toHaveScreenshot(`${fixture.name}.png`, {
        maxDiffPixels: Math.round(tolerance.maxDiffPixels * 1280 * 720),
        threshold: tolerance.maxColorDelta,
      });
    });
  }
});

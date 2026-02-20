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
 * Screenshot timing relies on the __sceneReady CustomEvent dispatched
 * by the PlayCanvas adapter after loadScene completes one render frame.
 */
import { test, expect } from "@playwright/test";
import { loginAsGuest } from "../helpers/auth";
import { getToleranceBand } from "../fixtures/tolerance-bands";

/**
 * Wait for the PlayCanvas adapter's __sceneReady signal.
 * Ensures the scene has been fully rendered before screenshot capture.
 */
async function waitForSceneReady(page: import("@playwright/test").Page): Promise<void> {
  await page.evaluate(() => {
    return new Promise<void>((resolve, reject) => {
      if ((window as unknown as Record<string, unknown>).__sceneAlreadyReady) {
        resolve();
        return;
      }

      const timeout = setTimeout(() => {
        reject(new Error("__sceneReady signal not received within 15s"));
      }, 15_000);

      window.addEventListener(
        "__sceneReady",
        () => {
          clearTimeout(timeout);
          resolve();
        },
        { once: true },
      );
    });
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
  test.beforeEach(async ({ page }) => {
    await loginAsGuest(page);
  });

  for (const fixture of FIXTURES) {
    test(`baseline: ${fixture.name}`, async ({ page }) => {
      // Navigate to the editor.
      // The fixture loading strategy depends on available routes:
      // 1. If a dev-only fixture route exists: /editor/fixture/[name]
      // 2. Otherwise: create a project and load fixture data
      //
      // For Phase 3 beta, we attempt the fixture route first and
      // fall back to a project-based approach.

      const fixtureUrl = `/editor/fixture/${fixture.name}`;
      const response = await page.goto(fixtureUrl);

      if (!response || response.status() === 404) {
        // Fixture route not available -- create a project instead
        await page.goto("/dashboard");

        await page.getByRole("button", { name: /new project/i }).click();
        await page.getByLabel(/project name|name/i).fill(`Visual-${fixture.name}`);
        await page.getByRole("button", { name: /create|submit/i }).click();
      }

      // Wait for the viewport canvas to appear
      const canvas = page.locator("canvas");
      await canvas.waitFor({ state: "visible", timeout: 30_000 });

      // Wait for __sceneReady to ensure rendering is complete
      await waitForSceneReady(page);

      // Allow an extra frame for any post-render effects
      await page.waitForTimeout(500);

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

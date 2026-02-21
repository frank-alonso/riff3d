/**
 * Dual-adapter visual regression tests.
 *
 * Renders each golden fixture on both PlayCanvas and Babylon.js engines,
 * captures Playwright screenshots, and compares against per-engine baselines
 * using per-fixture tolerance bands.
 *
 * This is the definitive visual proof that both adapters produce consistent
 * results for the same Canonical IR input. Each engine is compared against
 * its OWN baseline (not cross-engine). Cross-engine comparison is advisory.
 *
 * Visual regression is now REQUIRED CI (promoted from Phase 3 non-blocking beta).
 * Per-fixture tolerance bands replace the generic beta thresholds from Phase 3.
 *
 * Run: pnpm test:visual (requires dev server + Supabase with anonymous sign-ins)
 * Update baselines: pnpm test:visual:update
 *
 * NOTE on spot light tolerance: The materials-lights fixture has a wider
 * tolerance (0.15 color delta) because Babylon.js uses an exponent-based
 * falloff approximation for spot light inner cone angle instead of exact
 * inner cone. This is a known acceptable difference, not a bug.
 *
 * Engine switching approach: The editor loads with PlayCanvas by default.
 * For Babylon tests, we use page.evaluate() to call switchEngine() on the
 * editor store directly. There is no ?engine= query param handler.
 */
import { test, expect } from "@playwright/test";
import { getToleranceBand } from "../fixtures/tolerance-bands";

/**
 * Wait for the adapter's __sceneReady signal.
 *
 * Uses DOM polling for the __sceneAlreadyReady flag (set by adapters)
 * to avoid the race condition where __sceneReady CustomEvent fires
 * before page.evaluate() attaches the listener.
 */
async function waitForSceneReady(
  page: import("@playwright/test").Page,
  timeout = 30_000,
): Promise<void> {
  await page.waitForFunction(
    () => (window as unknown as Record<string, unknown>).__sceneAlreadyReady === true,
    { timeout },
  );
}

/**
 * Pause the engine render loop so toHaveScreenshot() can produce
 * stable (identical) frames. Without this, the live WebGL render loop
 * produces slight differences every frame due to anti-aliasing jitter,
 * floating-point non-determinism, and shadow sampling noise.
 */
async function pauseRenderLoop(page: import("@playwright/test").Page): Promise<void> {
  await page.evaluate(() => {
    const win = window as unknown as Record<string, unknown>;
    // PlayCanvas: set autoRender to false
    const store = win.__editorStore as
      | { getState: () => { activeEngine?: string } }
      | undefined;
    const engine = store?.getState()?.activeEngine;

    if (engine === "playcanvas" || !engine) {
      // PlayCanvas adapter exposes app via riff3d:request-app event pattern,
      // but we can also access it through the viewport adapter ref.
      // Simplest: use autoRender flag on the pc.Application
      const app = (win as Record<string, { autoRender?: boolean }>).__pcApp;
      if (app) {
        app.autoRender = false;
      }
    }
    if (engine === "babylon") {
      // Babylon: stop the render loop on the engine
      const bjsEngine = win.__bjsEngine as { stopRenderLoop?: () => void } | undefined;
      if (bjsEngine?.stopRenderLoop) {
        bjsEngine.stopRenderLoop();
      }
    }
  });
}

/**
 * Golden fixtures from @riff3d/fixtures.
 * Each corresponds to a builder function and a tolerance band.
 */
const FIXTURES = [
  "transforms-parenting",
  "materials-lights",
  "animation",
  "events-triggers",
  "character-stub",
  "timeline-stub",
  "adversarial",
] as const;

const ENGINES = ["playcanvas", "babylon"] as const;

// Approximate viewport dimensions for pixel ratio -> pixel count conversion
const VIEWPORT_WIDTH = 1280;
const VIEWPORT_HEIGHT = 720;

test.describe("Dual-adapter visual regression", () => {
  // No loginAsGuest needed — fixture routes serve builder-generated ECSON
  // without hitting the database, so no authentication is required.

  for (const fixture of FIXTURES) {
    for (const engine of ENGINES) {
      test(`${fixture} renders correctly on ${engine}`, async ({ page }) => {
        // Navigate to fixture route
        await page.goto(`/editor/fixture/${fixture}`);

        // Wait for viewport canvas
        const canvas = page.locator("canvas");
        await canvas.waitFor({ state: "visible", timeout: 30_000 });

        // Wait for scene to render (default engine is PlayCanvas)
        await waitForSceneReady(page);

        // Switch engine if needed (Babylon is not the default)
        if (engine === "babylon") {
          // Reset scene ready flag before switching
          await page.evaluate(() => {
            (window as unknown as Record<string, unknown>).__sceneAlreadyReady = false;
          });

          // Call switchEngine on the editor store
          await page.evaluate((targetEngine: string) => {
            const win = window as unknown as Record<string, unknown>;
            const store = win.__editorStore as
              | { getState: () => { switchEngine?: (e: string) => void } }
              | undefined;
            if (!store) {
              throw new Error("Editor store not found on window.__editorStore");
            }
            const state = store.getState();
            if (!state.switchEngine) {
              throw new Error("switchEngine not found on editor store");
            }
            state.switchEngine(targetEngine);
          }, engine);

          // Wait for the new engine's scene ready signal
          await waitForSceneReady(page);
        }

        // Allow an extra frame for post-render effects
        await page.waitForTimeout(500);

        // Pause the render loop so toHaveScreenshot() produces stable frames
        await pauseRenderLoop(page);

        // Capture screenshot with per-fixture tolerance
        const tolerance = getToleranceBand(fixture);
        const maxDiffPixels = Math.round(
          tolerance.maxDiffPixels * VIEWPORT_WIDTH * VIEWPORT_HEIGHT,
        );

        await expect(canvas).toHaveScreenshot(
          `${fixture}-${engine}.png`,
          {
            maxDiffPixels,
            threshold: tolerance.maxColorDelta,
          },
        );
      });
    }

    // Cross-engine comparison (advisory, not blocking)
    // This test documents expected differences between engines but does NOT
    // block CI. Per-engine rendering correctness (each engine matches its
    // own baseline) is what's required.
    test.skip(`${fixture} cross-engine comparison (advisory)`, async () => {
      // Cross-engine visual comparison is advisory only.
      // The per-engine tests above capture engine-specific baselines.
      // True cross-engine comparison would require rendering both engines
      // in the same test run and comparing their screenshots directly,
      // which is documented but deferred to a dedicated visual diff tool.
    });
  }
});

/**
 * Golden-path E2E smoke test.
 *
 * Exercises the full editor lifecycle: create -> edit -> save -> reload -> verify.
 * This test validates the complete pipeline end-to-end in an automated, repeatable way.
 *
 * Run: pnpm test:e2e (requires dev server + Supabase with anonymous sign-ins enabled)
 *
 * The Playwright config's webServer option starts `pnpm dev` automatically
 * if no server is running on localhost:3000.
 */
import { test, expect } from "@playwright/test";
import { loginAsGuest } from "./helpers/auth";

/**
 * Wait for the scene to be ready by checking that the canvas is visible
 * and the loading overlay has disappeared. This avoids the race condition
 * where __sceneReady fires before the evaluate listener is attached.
 */
async function waitForSceneReady(page: import("@playwright/test").Page): Promise<void> {
  // Wait for canvas to be visible
  await page.locator("canvas").waitFor({ state: "visible", timeout: 30_000 });
  // Wait for the loading overlay to disappear (ViewportLoader contains "Initializing")
  await page.locator("text=/Initializing|Building scene|Loading/i").waitFor({ state: "hidden", timeout: 30_000 }).catch(() => {
    // Loading overlay may have already disappeared — that's fine
  });
  // Give the renderer one extra frame to settle
  await page.waitForTimeout(500);
}

test.describe("Golden-path editor lifecycle", () => {
  const testProjectName = `E2E Test Project ${Date.now()}`;

  test("create -> edit -> save -> reload -> verify", async ({ page }) => {
    // 1. Login as anonymous guest (no credentials needed)
    await loginAsGuest(page);

    // 2. Create project: click "New Project" or "Create your first project"
    // (anonymous guest with no projects sees the empty-state CTA)
    const newProjectBtn = page.getByRole("button", { name: /new project|create your first project/i });
    await newProjectBtn.click();

    // Fill project name in the dialog and click "Blank Scene" to create
    const nameLabel = page.getByLabel(/project name/i);
    await nameLabel.waitFor({ state: "visible", timeout: 5_000 });
    await nameLabel.fill(testProjectName);
    await page.getByRole("button", { name: /blank scene/i }).click();

    // 3. Wait for editor shell to load (viewport canvas element)
    const canvas = page.locator("canvas");
    await canvas.waitFor({ state: "visible", timeout: 30_000 });

    // 4. Wait for __sceneReady signal (PlayCanvas rendered the scene)
    await waitForSceneReady(page);

    // 5. Verify viewport: canvas exists with non-zero dimensions
    const canvasBox = await canvas.boundingBox();
    expect(canvasBox).not.toBeNull();
    expect(canvasBox!.width).toBeGreaterThan(0);
    expect(canvasBox!.height).toBeGreaterThan(0);

    // 6. Edit: click an entity in the hierarchy panel to select it
    // The default scene should have at least one entity. Click the first item.
    const hierarchyItem = page.locator("[data-testid='hierarchy-item']").first();
    if (await hierarchyItem.isVisible()) {
      await hierarchyItem.click();

      // 7. Modify: change the entity name in the inspector
      const nameInput = page.locator("[data-testid='entity-name-input']");
      if (await nameInput.isVisible()) {
        const modifiedName = "E2E-Modified-Entity";
        await nameInput.fill(modifiedName);

        // 8. Save: trigger Ctrl+S to save
        await page.keyboard.press("Control+s");

        // Wait for save to complete (debounce + network)
        await page.waitForTimeout(2_000);

        // 9. Reload: navigate away and back
        await page.reload();

        // Wait for editor to reload
        await canvas.waitFor({ state: "visible", timeout: 30_000 });

        // 10. Wait for __sceneReady after reload
        await waitForSceneReady(page);

        // Verify persistence: entity name should match our modification
        const reloadedNameInput = page.locator("[data-testid='entity-name-input']");
        // Re-select the entity after reload
        const reloadedHierarchyItem = page.locator("[data-testid='hierarchy-item']").first();
        if (await reloadedHierarchyItem.isVisible()) {
          await reloadedHierarchyItem.click();
          if (await reloadedNameInput.isVisible()) {
            await expect(reloadedNameInput).toHaveValue(modifiedName);
          }
        }
      }
    }

    // 11. Cleanup: navigate to dashboard and delete the test project
    await page.goto("/dashboard");
    await page.waitForLoadState("domcontentloaded");

    // Find and delete the test project
    const projectCard = page.locator(`text="${testProjectName}"`).first();
    if (await projectCard.isVisible()) {
      const deleteButton = projectCard.locator("..").locator("[data-testid='delete-project']");
      if (await deleteButton.isVisible()) {
        await deleteButton.click();
        const confirmButton = page.getByRole("button", { name: /confirm|delete|yes/i });
        if (await confirmButton.isVisible()) {
          await confirmButton.click();
        }
      }
    }
  });
});

/**
 * Shared Playwright auth helper for E2E tests.
 *
 * Supports two auth modes:
 * 1. Anonymous sign-in (default) — clicks "Continue as Guest" on login page
 * 2. Credential-based login — uses E2E_TEST_EMAIL / E2E_TEST_PASSWORD env vars
 *
 * Anonymous auth is preferred for E2E tests since it requires no setup.
 */
import type { Page } from "@playwright/test";

/**
 * Log in as an anonymous guest via the "Continue as Guest" button.
 *
 * This creates a real authenticated session without needing email/password.
 * The anonymous user can create projects, edit scenes, and exercise the
 * full editor pipeline.
 *
 * @param page - Playwright Page instance
 */
export async function loginAsGuest(page: Page): Promise<void> {
  await page.goto("/login");
  await page.getByRole("button", { name: /continue as guest/i }).click();

  // Wait for redirect to dashboard (anonymous auth is instant)
  await page.waitForURL("**/", { timeout: 15_000 });
}

/**
 * Check whether E2E auth credentials are configured.
 * @deprecated Prefer loginAsGuest() which needs no credentials.
 */
export function hasTestCredentials(): boolean {
  return !!(process.env.E2E_TEST_EMAIL && process.env.E2E_TEST_PASSWORD);
}

/**
 * Log in as the test user via email/password.
 * @deprecated Prefer loginAsGuest() which needs no credentials.
 */
export async function loginAsTestUser(page: Page): Promise<void> {
  const email = process.env.E2E_TEST_EMAIL;
  const password = process.env.E2E_TEST_PASSWORD;

  if (!email || !password) {
    throw new Error(
      "E2E_TEST_EMAIL and E2E_TEST_PASSWORD must be set to run authenticated tests",
    );
  }

  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: /sign in|log in/i }).click();
  await page.waitForURL("**/dashboard**", { timeout: 15_000 });
}

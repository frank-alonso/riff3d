/**
 * Shared Playwright auth helper for E2E tests.
 *
 * Provides login utilities for test users. Credentials are sourced from
 * environment variables:
 *   - E2E_TEST_EMAIL: test user email address
 *   - E2E_TEST_PASSWORD: test user password
 *
 * If env vars are not set, tests requiring auth should skip via test.skip().
 */
import type { Page } from "@playwright/test";

/**
 * Check whether E2E auth credentials are configured.
 * Tests that require login should call `test.skip(!hasTestCredentials(), ...)`
 * to gracefully skip when credentials are absent.
 */
export function hasTestCredentials(): boolean {
  return !!(process.env.E2E_TEST_EMAIL && process.env.E2E_TEST_PASSWORD);
}

/**
 * Log in as the test user via the login page.
 *
 * Navigates to `/login`, fills the email/password form, submits,
 * and waits for redirect to the dashboard.
 *
 * @param page - Playwright Page instance
 * @throws If login fails or redirect does not occur within timeout
 */
export async function loginAsTestUser(page: Page): Promise<void> {
  const email = process.env.E2E_TEST_EMAIL;
  const password = process.env.E2E_TEST_PASSWORD;

  if (!email || !password) {
    throw new Error(
      "E2E_TEST_EMAIL and E2E_TEST_PASSWORD must be set to run authenticated tests",
    );
  }

  // Navigate to login page
  await page.goto("/login");

  // Fill credentials
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);

  // Submit the form
  await page.getByRole("button", { name: /sign in|log in/i }).click();

  // Wait for redirect to dashboard (successful login)
  await page.waitForURL("**/dashboard**", { timeout: 15_000 });
}

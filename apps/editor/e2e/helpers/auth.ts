/**
 * Shared Playwright auth helper for E2E tests.
 *
 * Uses cached auth state to avoid Supabase anonymous signup rate limits.
 * The first run creates an anonymous session and saves cookies/storage
 * to a file. Subsequent runs reuse the cached state if the JWT hasn't
 * expired, avoiding the rate-limited POST /signup endpoint entirely.
 */
import type { Page } from "@playwright/test";
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const AUTH_STATE_PATH = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  ".auth-state.json",
);
const AUTH_STATE_MAX_AGE_MS = 30 * 60 * 1000; // 30 minutes

/**
 * Check if cached auth state exists and is still fresh.
 */
function hasFreshAuthState(): boolean {
  try {
    const stat = fs.statSync(AUTH_STATE_PATH);
    return Date.now() - stat.mtimeMs < AUTH_STATE_MAX_AGE_MS;
  } catch {
    return false;
  }
}

/**
 * Log in as an anonymous guest, reusing cached auth state when possible.
 *
 * On first call (or when cache is stale), clicks "Continue as Guest"
 * to create a real Supabase anonymous session, then saves the browser
 * state for reuse. Subsequent calls within 30 minutes load the cached
 * state directly, avoiding the rate-limited signup endpoint.
 */
export async function loginAsGuest(page: Page): Promise<void> {
  if (hasFreshAuthState()) {
    // Load cached auth state — restores cookies + localStorage
    const state = JSON.parse(fs.readFileSync(AUTH_STATE_PATH, "utf-8"));
    await page.context().addCookies(state.cookies ?? []);
    if (state.origins) {
      for (const origin of state.origins) {
        await page.goto(origin.origin, { waitUntil: "domcontentloaded" });
        for (const item of origin.localStorage ?? []) {
          await page.evaluate(
            ({ key, value }) => localStorage.setItem(key, value),
            item,
          );
        }
      }
    }
    await page.goto("/");
    return;
  }

  // Fresh login — create anonymous session
  await page.goto("/login", { waitUntil: "networkidle" });
  await page.getByRole("button", { name: /continue as guest/i }).click();

  // Wait for navigation away from login page.
  // "/" is in middleware's public routes, so the redirect succeeds
  // even if the auth cookie hasn't fully flushed yet.
  await page.waitForURL((url) => !url.pathname.startsWith("/login"), {
    timeout: 15_000,
  });

  // Cache the auth state for subsequent runs
  const state = await page.context().storageState();
  fs.writeFileSync(AUTH_STATE_PATH, JSON.stringify(state));
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

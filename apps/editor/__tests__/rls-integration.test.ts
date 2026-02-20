import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * RLS integration tests against a live Supabase instance.
 *
 * These tests verify actual Row Level Security behavior: that owners can
 * CRUD their own projects, non-owners are denied, and public projects
 * are readable by anyone.
 *
 * Requirements:
 *   - SUPABASE_URL: project URL
 *   - SUPABASE_ANON_KEY: anon/public key
 *   - SUPABASE_SERVICE_KEY: service role key (for test setup/cleanup)
 *   - TEST_USER_A_EMAIL / TEST_USER_A_PASSWORD: test user A credentials
 *   - TEST_USER_B_EMAIL / TEST_USER_B_PASSWORD: test user B credentials
 *
 * Run: pnpm test:integration (from apps/editor)
 * Skipped automatically when env vars are not set.
 */

const SUPABASE_URL = process.env["SUPABASE_URL"];
const SUPABASE_ANON_KEY = process.env["SUPABASE_ANON_KEY"];
const SUPABASE_SERVICE_KEY = process.env["SUPABASE_SERVICE_KEY"];
const TEST_USER_A_EMAIL = process.env["TEST_USER_A_EMAIL"];
const TEST_USER_A_PASSWORD = process.env["TEST_USER_A_PASSWORD"];
const TEST_USER_B_EMAIL = process.env["TEST_USER_B_EMAIL"];
const TEST_USER_B_PASSWORD = process.env["TEST_USER_B_PASSWORD"];

const canRun =
  SUPABASE_URL &&
  SUPABASE_ANON_KEY &&
  SUPABASE_SERVICE_KEY &&
  TEST_USER_A_EMAIL &&
  TEST_USER_A_PASSWORD &&
  TEST_USER_B_EMAIL &&
  TEST_USER_B_PASSWORD;

/** Prefix for all test-created project names. Used for cleanup. */
const TEST_PREFIX = "test_rls_";

describe.skipIf(!canRun)("RLS integration tests", () => {
  let serviceClient: SupabaseClient;
  let userAClient: SupabaseClient;
  let userBClient: SupabaseClient;
  let anonClient: SupabaseClient;
  let userAId: string;
  let userBId: string;

  /** IDs of projects created during tests, for cleanup. */
  const createdProjectIds: string[] = [];

  beforeAll(async () => {
    // Service client (bypasses RLS) for setup/cleanup
    serviceClient = createClient(SUPABASE_URL!, SUPABASE_SERVICE_KEY!, {
      auth: { persistSession: false },
    });

    // User A client
    userAClient = createClient(SUPABASE_URL!, SUPABASE_ANON_KEY!, {
      auth: { persistSession: false },
    });
    const { data: signInA, error: errA } =
      await userAClient.auth.signInWithPassword({
        email: TEST_USER_A_EMAIL!,
        password: TEST_USER_A_PASSWORD!,
      });
    if (errA || !signInA.user) {
      throw new Error(`Failed to sign in user A: ${errA?.message}`);
    }
    userAId = signInA.user.id;

    // User B client
    userBClient = createClient(SUPABASE_URL!, SUPABASE_ANON_KEY!, {
      auth: { persistSession: false },
    });
    const { data: signInB, error: errB } =
      await userBClient.auth.signInWithPassword({
        email: TEST_USER_B_EMAIL!,
        password: TEST_USER_B_PASSWORD!,
      });
    if (errB || !signInB.user) {
      throw new Error(`Failed to sign in user B: ${errB?.message}`);
    }
    userBId = signInB.user.id;

    // Anonymous client (no auth)
    anonClient = createClient(SUPABASE_URL!, SUPABASE_ANON_KEY!, {
      auth: { persistSession: false },
    });
  });

  afterAll(async () => {
    // Clean up test projects using service client (bypasses RLS)
    if (createdProjectIds.length > 0) {
      await serviceClient
        .from("projects")
        .delete()
        .in("id", createdProjectIds);
    }

    // Also clean any stale test projects by prefix
    await serviceClient
      .from("projects")
      .delete()
      .like("name", `${TEST_PREFIX}%`);

    // Sign out test users
    await userAClient.auth.signOut();
    await userBClient.auth.signOut();
  });

  it("owner can create and read own project", async () => {
    const projectName = `${TEST_PREFIX}owner_read_${Date.now()}`;
    const { data: inserted, error: insertErr } = await userAClient
      .from("projects")
      .insert({
        name: projectName,
        owner_id: userAId,
        ecson: {},
        is_public: false,
      })
      .select()
      .single();

    expect(insertErr).toBeNull();
    expect(inserted).not.toBeNull();
    expect(inserted!.name).toBe(projectName);
    createdProjectIds.push(inserted!.id);

    // Read it back
    const { data: fetched, error: fetchErr } = await userAClient
      .from("projects")
      .select("*")
      .eq("id", inserted!.id)
      .single();

    expect(fetchErr).toBeNull();
    expect(fetched).not.toBeNull();
    expect(fetched!.name).toBe(projectName);
  });

  it("non-owner cannot read private project", async () => {
    const projectName = `${TEST_PREFIX}non_owner_read_${Date.now()}`;
    const { data: inserted, error: insertErr } = await userAClient
      .from("projects")
      .insert({
        name: projectName,
        owner_id: userAId,
        ecson: {},
        is_public: false,
      })
      .select()
      .single();

    expect(insertErr).toBeNull();
    createdProjectIds.push(inserted!.id);

    // User B tries to read User A's private project
    const { data: rows, error: readErr } = await userBClient
      .from("projects")
      .select("*")
      .eq("id", inserted!.id);

    expect(readErr).toBeNull();
    // RLS should filter out the row -- 0 results
    expect(rows).toHaveLength(0);
  });

  it("owner can update own project", async () => {
    const projectName = `${TEST_PREFIX}owner_update_${Date.now()}`;
    const { data: inserted, error: insertErr } = await userAClient
      .from("projects")
      .insert({
        name: projectName,
        owner_id: userAId,
        ecson: {},
        is_public: false,
      })
      .select()
      .single();

    expect(insertErr).toBeNull();
    createdProjectIds.push(inserted!.id);

    const updatedName = `${projectName}_updated`;
    const { data: updated, error: updateErr } = await userAClient
      .from("projects")
      .update({ name: updatedName })
      .eq("id", inserted!.id)
      .select()
      .single();

    expect(updateErr).toBeNull();
    expect(updated).not.toBeNull();
    expect(updated!.name).toBe(updatedName);
  });

  it("non-owner cannot update project", async () => {
    const projectName = `${TEST_PREFIX}non_owner_update_${Date.now()}`;
    const { data: inserted, error: insertErr } = await userAClient
      .from("projects")
      .insert({
        name: projectName,
        owner_id: userAId,
        ecson: {},
        is_public: false,
      })
      .select()
      .single();

    expect(insertErr).toBeNull();
    createdProjectIds.push(inserted!.id);

    // User B tries to update User A's project
    const { data: updated, error: updateErr } = await userBClient
      .from("projects")
      .update({ name: `${projectName}_hacked` })
      .eq("id", inserted!.id)
      .select();

    // RLS should prevent the update -- 0 rows affected
    expect(updateErr).toBeNull();
    expect(updated).toHaveLength(0);

    // Verify original is unchanged
    const { data: original } = await userAClient
      .from("projects")
      .select("name")
      .eq("id", inserted!.id)
      .single();
    expect(original!.name).toBe(projectName);
  });

  it("non-owner cannot delete project", async () => {
    const projectName = `${TEST_PREFIX}non_owner_delete_${Date.now()}`;
    const { data: inserted, error: insertErr } = await userAClient
      .from("projects")
      .insert({
        name: projectName,
        owner_id: userAId,
        ecson: {},
        is_public: false,
      })
      .select()
      .single();

    expect(insertErr).toBeNull();
    createdProjectIds.push(inserted!.id);

    // User B tries to delete User A's project
    const { data: deleted, error: deleteErr } = await userBClient
      .from("projects")
      .delete()
      .eq("id", inserted!.id)
      .select();

    // RLS should prevent the delete -- 0 rows affected
    expect(deleteErr).toBeNull();
    expect(deleted).toHaveLength(0);

    // Verify still exists
    const { data: stillExists } = await userAClient
      .from("projects")
      .select("id")
      .eq("id", inserted!.id);
    expect(stillExists).toHaveLength(1);
  });

  it("anonymous can read public project", async () => {
    const projectName = `${TEST_PREFIX}public_read_${Date.now()}`;
    const { data: inserted, error: insertErr } = await userAClient
      .from("projects")
      .insert({
        name: projectName,
        owner_id: userAId,
        ecson: {},
        is_public: true,
      })
      .select()
      .single();

    expect(insertErr).toBeNull();
    createdProjectIds.push(inserted!.id);

    // Anonymous client reads the public project
    const { data: rows, error: readErr } = await anonClient
      .from("projects")
      .select("*")
      .eq("id", inserted!.id);

    expect(readErr).toBeNull();
    expect(rows).toHaveLength(1);
    expect(rows![0]!.name).toBe(projectName);
  });

  it("anonymous cannot read private project", async () => {
    const projectName = `${TEST_PREFIX}anon_private_${Date.now()}`;
    const { data: inserted, error: insertErr } = await userAClient
      .from("projects")
      .insert({
        name: projectName,
        owner_id: userAId,
        ecson: {},
        is_public: false,
      })
      .select()
      .single();

    expect(insertErr).toBeNull();
    createdProjectIds.push(inserted!.id);

    // Anonymous client tries to read private project
    const { data: rows, error: readErr } = await anonClient
      .from("projects")
      .select("*")
      .eq("id", inserted!.id);

    expect(readErr).toBeNull();
    expect(rows).toHaveLength(0);
  });

  it("owner can delete own project", async () => {
    const projectName = `${TEST_PREFIX}owner_delete_${Date.now()}`;
    const { data: inserted, error: insertErr } = await userAClient
      .from("projects")
      .insert({
        name: projectName,
        owner_id: userAId,
        ecson: {},
        is_public: false,
      })
      .select()
      .single();

    expect(insertErr).toBeNull();
    // Don't add to cleanup list -- we're deleting it here

    const { error: deleteErr } = await userAClient
      .from("projects")
      .delete()
      .eq("id", inserted!.id);

    expect(deleteErr).toBeNull();

    // Verify it's gone
    const { data: rows } = await userAClient
      .from("projects")
      .select("id")
      .eq("id", inserted!.id);
    expect(rows).toHaveLength(0);
  });
});

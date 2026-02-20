import { describe, it, expect, beforeAll } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

/**
 * Mocked RLS policy structural tests.
 *
 * These tests read the migration SQL file and verify that the correct
 * Row Level Security (RLS) policy definitions are present. No Supabase
 * connection is needed -- just the migration file on disk.
 *
 * Purpose: Fast CI feedback that policy changes don't silently break
 * data isolation guarantees.
 */

let migrationSql: string;

beforeAll(() => {
  const migrationPath = resolve(
    __dirname,
    "../supabase/migration-001-projects.sql",
  );
  migrationSql = readFileSync(migrationPath, "utf-8");
});

describe("RLS policy structural tests", () => {
  describe("RLS enablement", () => {
    it("enables RLS on the projects table", () => {
      // Match: ALTER TABLE projects ENABLE ROW LEVEL SECURITY
      // or: ENABLE ROW LEVEL SECURITY (after CREATE TABLE projects)
      expect(migrationSql).toMatch(
        /ALTER\s+TABLE\s+projects\s+ENABLE\s+ROW\s+LEVEL\s+SECURITY/i,
      );
    });

    it("does not disable RLS on the projects table", () => {
      expect(migrationSql).not.toMatch(
        /ALTER\s+TABLE\s+projects\s+DISABLE\s+ROW\s+LEVEL\s+SECURITY/i,
      );
    });
  });

  describe("owner CRUD policies", () => {
    it("has a SELECT policy using auth.uid() = owner_id", () => {
      // Should have a SELECT policy with USING (auth.uid() = owner_id)
      const selectPolicyPattern =
        /CREATE\s+POLICY\s+[^\n]*\s+ON\s+projects\s+FOR\s+SELECT\s+USING\s*\(\s*auth\.uid\(\)\s*=\s*owner_id\s*\)/i;
      expect(migrationSql).toMatch(selectPolicyPattern);
    });

    it("has an INSERT policy with WITH CHECK using auth.uid() = owner_id", () => {
      const insertPolicyPattern =
        /CREATE\s+POLICY\s+[^\n]*\s+ON\s+projects\s+FOR\s+INSERT\s+WITH\s+CHECK\s*\(\s*auth\.uid\(\)\s*=\s*owner_id\s*\)/i;
      expect(migrationSql).toMatch(insertPolicyPattern);
    });

    it("has an UPDATE policy using auth.uid() = owner_id", () => {
      const updatePolicyPattern =
        /CREATE\s+POLICY\s+[^\n]*\s+ON\s+projects\s+FOR\s+UPDATE\s+USING\s*\(\s*auth\.uid\(\)\s*=\s*owner_id\s*\)/i;
      expect(migrationSql).toMatch(updatePolicyPattern);
    });

    it("has a DELETE policy using auth.uid() = owner_id", () => {
      const deletePolicyPattern =
        /CREATE\s+POLICY\s+[^\n]*\s+ON\s+projects\s+FOR\s+DELETE\s+USING\s*\(\s*auth\.uid\(\)\s*=\s*owner_id\s*\)/i;
      expect(migrationSql).toMatch(deletePolicyPattern);
    });
  });

  describe("public read policy", () => {
    it("has a public SELECT policy using is_public = true", () => {
      // The projects table has is_public column, so we expect a public read policy
      const publicReadPattern =
        /CREATE\s+POLICY\s+[^\n]*\s+ON\s+projects\s+FOR\s+SELECT\s+USING\s*\(\s*is_public\s*=\s*true\s*\)/i;
      expect(migrationSql).toMatch(publicReadPattern);
    });
  });

  describe("no unsafe policy patterns", () => {
    it("does not grant ALL bypassing RLS", () => {
      // GRANT ALL ON projects without RLS consideration would be a security hole
      expect(migrationSql).not.toMatch(
        /GRANT\s+ALL\s+ON\s+(?:TABLE\s+)?projects/i,
      );
    });

    it("does not have USING (true) on UPDATE policies", () => {
      // USING (true) on UPDATE would let any authenticated user modify any row
      const unsafeUpdatePattern =
        /CREATE\s+POLICY\s+[^\n]*\s+ON\s+projects\s+FOR\s+UPDATE[^;]*USING\s*\(\s*true\s*\)/i;
      expect(migrationSql).not.toMatch(unsafeUpdatePattern);
    });

    it("does not have USING (true) on DELETE policies", () => {
      const unsafeDeletePattern =
        /CREATE\s+POLICY\s+[^\n]*\s+ON\s+projects\s+FOR\s+DELETE[^;]*USING\s*\(\s*true\s*\)/i;
      expect(migrationSql).not.toMatch(unsafeDeletePattern);
    });

    it("does not have WITH CHECK (true) on INSERT policies", () => {
      const unsafeInsertPattern =
        /CREATE\s+POLICY\s+[^\n]*\s+ON\s+projects\s+FOR\s+INSERT[^;]*WITH\s+CHECK\s*\(\s*true\s*\)/i;
      expect(migrationSql).not.toMatch(unsafeInsertPattern);
    });
  });

  describe("policy completeness", () => {
    it("has exactly 5 policies on the projects table", () => {
      // 4 owner CRUD + 1 public read = 5 policies
      const policyMatches = migrationSql.match(
        /CREATE\s+POLICY\s+[^\n]*\s+ON\s+projects/gi,
      );
      expect(policyMatches).toHaveLength(5);
    });

    it("references auth.uid() in all owner policies", () => {
      // Every non-public policy should reference auth.uid()
      const authUidMatches = migrationSql.match(/auth\.uid\(\)/g);
      // 4 owner policies (SELECT, INSERT, UPDATE, DELETE) each reference auth.uid()
      expect(authUidMatches).not.toBeNull();
      expect(authUidMatches!.length).toBeGreaterThanOrEqual(4);
    });
  });
});

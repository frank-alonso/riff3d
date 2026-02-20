# Phase 3 Plan Review — 03-04
Date: 2026-02-20  
Auditor: Codex (gpt-5.3-codex)  
Plan: 03-04-PLAN.md

## Codebase Verification
Checked:
- `.planning/phases/03-review-gate-foundation/03-04-PLAN.md`
- `apps/editor/supabase/migration-001-projects.sql`
- `apps/editor/package.json`
- `vitest.config.ts`
- `pnpm-workspace.yaml`
- `apps/editor/src/lib/supabase/client.ts`
- `apps/editor/src/lib/supabase/server.ts`
- `apps/editor/.env.local.example`
- `apps/editor/src/components/dashboard/new-project-modal.tsx`

Matched:
- Migration file exists and contains RLS enable + owner CRUD + public read policy (`apps/editor/supabase/migration-001-projects.sql:16`, `apps/editor/supabase/migration-001-projects.sql:19`, `apps/editor/supabase/migration-001-projects.sql:23`, `apps/editor/supabase/migration-001-projects.sql:27`, `apps/editor/supabase/migration-001-projects.sql:31`, `apps/editor/supabase/migration-001-projects.sql:36`).
- `@supabase/supabase-js` already exists in editor deps (`apps/editor/package.json:19`).

Mismatches:
- **S1:** Plan claims mocked tests run in standard `pnpm test` (`03-04-PLAN.md:19`, `03-04-PLAN.md:155`), but editor currently has no `test` script (`apps/editor/package.json:6`) and root Vitest workspace only targets `packages/*` (`vitest.config.ts:5`), so editor tests will not run unless explicitly wired.
- **S1:** Verification command is invalid: `pnpm vitest run --filter ...` (`03-04-PLAN.md:147`). In this repo’s Vitest 4, `--filter` is an unknown option (confirmed by execution error).
- **S2:** Env var names in plan (`SUPABASE_URL`, `SUPABASE_ANON_KEY`; `03-04-PLAN.md:96`, `03-04-PLAN.md:104-106`) do not match app conventions (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`; `apps/editor/.env.local.example:3-4`, `apps/editor/src/lib/supabase/client.ts:5-6`).
- **S2:** `apps/editor/__tests__/` does not exist yet. That is fine for implementation, but current verification bullets using `grep -l` on that directory (`03-04-PLAN.md:165-166`) are currently non-functional and also semantically weak (`grep -l` checks content, not filename existence).

## Feasibility
Mostly feasible, but not executable as written without wiring changes:
- Add editor `test` script (not just `test:integration`) if mocked tests must run in `pnpm test`.
- Decide test runner entrypoint: package-local `vitest.config.ts` vs root workspace inclusion.
- Fix CLI commands and env naming conventions.

## Completeness
Gaps:
- **S1:** Missing explicit plan step to add `apps/editor` `test` script, required by its own must-have.
- **S2:** No concrete strategy for deterministic auth test users/secrets (pre-created accounts vs admin API flow) and where credentials come from.
- **S2:** Cleanup plan (`test_` prefix) is broad and may affect non-test data on shared Supabase projects.

## Architecture Alignment
Generally aligned:
- Changes are test/config only in `apps/editor`; no violations of pipeline or package dependency order.
- No proposed direct ECSON mutation or adapter boundary violation.

Minor caution:
- Integration tests should avoid coupling to app internals and remain DB-policy focused.

## Risk Assessment
Real risks identified by plan:
- Silent RLS regressions are a legitimate security risk.

Missed/understated risks:
- **S1:** False confidence risk if mocked tests are not actually in default CI path.
- **S2:** Data safety risk from prefix-based cleanup on shared DB.
- **S2:** Flakiness risk from auth/session state and external environment prerequisites.

## Correctness
Issues:
- **S1:** Invalid Vitest command (`--filter`) in verification (`03-04-PLAN.md:147`).
- **S1:** “`pnpm test` runs mocked tests” is not true with current workspace config (`vitest.config.ts:5`, `apps/editor/package.json:6-12`).
- **S2:** Env var mismatch with existing repo conventions (`03-04-PLAN.md:96-106` vs `apps/editor/.env.local.example:3-4`).

## Test Strategy
Two-layer strategy is sound in principle (structural SQL + live RLS behavior).  
Improvements needed:
- Add explicit negative integration checks for non-owner `DELETE` and impersonation on `INSERT` (`owner_id != auth.uid()`).
- Make mocked SQL assertions strict enough to detect accidental broadening (e.g., policy count/type checks).
- Separate integration execution reliably (script/config) while ensuring default CI includes structural tests.

## Summary
- Key concerns:
  - S1: Default test-path claim is currently incorrect (`pnpm test` will not include editor tests without extra wiring).
  - S1: Verification command in plan is invalid for Vitest 4.
  - S2: Env variable naming in plan diverges from existing editor conventions.
  - S2: Integration cleanup and user provisioning are under-specified and risky.
- Recommended adjustments:
  1. Add `apps/editor` scripts: `test` (structural) and `test:integration` (live), and ensure Turbo runs `test` for editor.
  2. Replace invalid verify command with a valid one (e.g., `pnpm --filter @riff3d/editor exec vitest run __tests__/rls-policies.test.ts`).
  3. Standardize env variables for integration tests (either adopt existing `NEXT_PUBLIC_*` names or document separate test-only vars clearly).
  4. Add explicit safe cleanup boundaries (dedicated test project/schema or uniquely tagged rows + owner scoping).
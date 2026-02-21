# Phase 6 Plan Review
Date: 2026-02-20
Auditor: Codex (gpt-5.3-codex)

## Codebase Verification
Checked plan files:
- `.planning/phases/06-review-gate-core-platform/06-01-PLAN.md`
- `.planning/phases/06-review-gate-core-platform/06-02-PLAN.md`
- `.planning/phases/06-review-gate-core-platform/06-03-PLAN.md`

Verified against source and config:
- `servers/collab/src/server.ts`
- `servers/collab/src/auth.ts`
- `servers/collab/src/persistence.ts`
- `apps/editor/src/collaboration/sync-bridge.ts`
- `apps/editor/src/collaboration/avatar-controller.ts`
- `apps/editor/src/collaboration/provider.tsx`
- `apps/editor/src/stores/slices/scene-slice.ts`
- `apps/editor/src/stores/slices/engine-slice.ts`
- `apps/editor/src/stores/slices/playtest-slice.ts`
- `eslint.config.mjs`
- `scripts/check-adapter-loc.sh`
- `apps/editor/playwright.config.ts`
- `apps/editor/e2e/*`
- workspace `package.json` files

What matched:
- Adapter boundary lint guard exists (`eslint.config.mjs:33`).
- Adapters import Canonical IR only (no `@riff3d/ecson`/`@riff3d/patchops` imports in adapter src).
- LoC budget enforcement script exists and currently passes.
- PatchOps spine is primary mutation path in scene slice (`apps/editor/src/stores/slices/scene-slice.ts:145`).

What did not match:
- CF-P5-02 unresolved: yaw still resets to `0` (`apps/editor/src/collaboration/avatar-controller.ts:139`).
- CF-P5-04 unresolved: no `_shapeVersion`/`COLLAB_SHAPE_VERSION` in sync bridge.
- CF-P5-05 unresolved: no `servers/collab` test infra (`servers/collab/package.json:6`, `servers/collab/tsconfig.json:21`).
- `06-02` references non-existent `apps/editor/e2e/editor-smoke.spec.ts` (`06-02-PLAN.md:69`).
- Planned `stress-collab.spec.ts` won’t be discovered by current Playwright config (expects `.e2e.ts` / `.visual.ts`) (`apps/editor/playwright.config.ts:28`).

## Feasibility
- **S0** Success-criteria mismatch risk: non-owners are forced read-only (`servers/collab/src/server.ts:51`), so “two concurrent users collaboratively build” is not feasible unless both sessions use owner credentials.
- **S1** `06-02` E2E naming/command path is infeasible as written (`06-02-PLAN.md:30`, `06-02-PLAN.md:245`) versus `apps/editor/playwright.config.ts:15`.
- **S1** Plan assumes property-level merge on same entity in ways current model does not guarantee (`sync-bridge` syncs entity top-level keys; `components` is a single key) (`apps/editor/src/collaboration/sync-bridge.ts:181`).

## Completeness
- **S1** Sync coverage gap is not planned for fix: `metadata`, `meta` map updates, and `gameSettings` are not synchronized in incremental paths; observers also ignore metadata/meta (`apps/editor/src/collaboration/sync-bridge.ts:223`, `apps/editor/src/collaboration/sync-bridge.ts:333`).
- **S1** Persistence error handling gap is not covered: `fetch` treats any DB error as “no doc” (`servers/collab/src/persistence.ts:24`), risking silent state replacement.
- **S2** Phase debt coverage appears incomplete: known Phase 6 lint carry-forward in `.planning/STATE.md:184` is not included in 06-01 tasks.

## Architecture Alignment
- **S1** “All ECSON fields” claim is currently false for collaboration pipeline: `gameSettings` is part of schema (`packages/ecson/src/schemas/scene-document.ts:26`) but omitted in `initializeYDoc`, `syncToYDoc`, `yDocToEcson`, and server decode path.
- **S2** PatchOps boundary mostly holds with documented exceptions (`loadProject`, `playtest stop`, `switchEngine`), and `switchEngine` direct mutation is present (`apps/editor/src/stores/slices/engine-slice.ts:74`).
- **S2** Adapter boundary is aligned and mechanically enforced.

## Risk Assessment
- **S1** Persistence dual-write race/consistency risk: Y.Doc upsert and `projects.ecson` update are non-atomic; second write is fire-and-forget (`servers/collab/src/persistence.ts:120`).
- **S1** Auth/access model risk for product goal: no collaborator write role, only owner writes.
- **S2** Token replay hardening is minimal; auth relies on `supabase.auth.getUser(token)` without extra replay/session constraints (`servers/collab/src/auth.ts:54`).
- **S2** Minimal shape-versioning (v0→v1 stamp) is acceptable as bootstrap, but migration should run in both client and server decode paths to avoid divergent behavior.

## Alternative Approaches
1. Use `stress-collab.e2e.ts` and run via editor package script (`pnpm --filter @riff3d/editor test:e2e -- --list`) to match config.
2. Expand sync bridge contract now to include `gameSettings`, metadata syncing, and meta observers; add explicit tests before stress tests.
3. Make persistence fail-closed on non-404 errors and differentiate “not found” vs real DB failures.
4. Clarify collaboration write policy: owner-only (then update SC1 wording) or true multi-user edit (then add collaborator authorization model).

## Test Strategy
- **S1** Current test plan under-covers critical failure modes: DB error classification, non-atomic dual-write fallout, and missing-field sync (`gameSettings`/metadata).
- **S2** FPS criterion mismatch: plan allows `>=25` (`06-02-PLAN.md:209`) while locked decision says 30 FPS floor (`06-CONTEXT.md:41`).
- **S2** Add explicit tests for:
  - sync bridge field parity including `gameSettings`
  - metadata/meta propagation and observer triggers
  - persistence `fetch` behavior for `PGRST116` vs other errors
  - owner/non-owner edit capability aligned to SC1 wording

## Summary
- Key concerns:
- **S0** SC1 feasibility conflict with owner-only write mode.
- **S1** Sync bridge and persistence have unplanned correctness gaps that can cause silent drift/data loss.
- **S1** `06-02` E2E file naming/commands do not match Playwright configuration.
- Recommended adjustments:
- Rebaseline 06-02 test file naming/commands to actual `apps/editor/playwright.config.ts`.
- Add explicit plan tasks for sync field completeness (`metadata`, `gameSettings`, meta observers) and persistence error semantics.
- Resolve SC1 policy ambiguity before execution (owner-only vs multi-writer collaboration) and align tests/success criteria accordingly.
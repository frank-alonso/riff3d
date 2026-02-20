# Phase 3 Plan Review Response

**Date:** 2026-02-20
**Reviewer:** Claude (Driver)
**Responding to:** PHASE_3_PLAN_REVIEW.md (Synthesis) + 7 per-plan reviews

## Response to S0 Findings

### S0-1: Camera-controller ownership in adapter split (03-03)

**Agree — will fix during execution.** The camera-controller is imported by `adapter.ts` for editor-mode camera setup. During the 03-03 split, the executor will:
1. Check if `adapter.ts` has a hard dependency on camera-controller or just initializes it
2. If hard dependency: keep camera-controller in core OR extract the initialization interface
3. If soft dependency (initialization only): move to editor-tools and have the editor pass the controller instance

This is exactly the kind of detail that emerges during execution. The plan's action steps already include "move files to editor-tools/" which will naturally surface this. The executor will resolve it in-situ rather than requiring a plan revision.

### S0-2: Core handoff risk (03-03 -> 03-05/03-06)

**Agree — already mitigated by dependency chain.** Plans 03-05 and 03-06 depend on 03-03 precisely because the adapter split must be stable before drag-preview and E2E work begins. The executor won't start Wave 3 until 03-03 passes its verify commands (`pnpm turbo typecheck`, all tests pass). If 03-03 fails typecheck, Wave 3 blocks automatically.

## Response to S1 Findings

### S1-1: Hidden dependency 03-05 on 03-01 (mock infra)

**Agree — note for executor.** Plan 03-05's drag-preview tests will need the mock infrastructure from 03-01. However, both are in different waves (03-01 is Wave 1, 03-05 is Wave 3), so 03-01 will always complete first. The dependency is implicit but satisfied by wave ordering. Will note this for the executor.

### S1-2: 03-07 depends on missing prerequisite artifacts

**Agree — expected behavior.** Plan 03-07 is the review gate that runs AFTER all implementation plans. The artifacts it depends on (test results, LoC script, budgets.ts) are created by plans 03-01 through 03-06. Since 03-07 depends on all prior plans, these artifacts will exist. The preflight check suggestion is good — the executor should verify artifacts exist before running the evidence compilation.

### S1-3: 03-04 mocked tests not in default `pnpm test` path

**Agree — will fix during execution.** The executor will ensure `apps/editor/package.json` has a `test` script that includes the structural RLS tests, and that turbo.json includes the editor's test task. Integration tests will be under a separate `test:integration` script as specified.

### S1-4: Auth contract mismatch in 03-06

**Agree — will fix during execution.** The E2E test needs to use the actual auth flow (magic link). For E2E testing, we'll either:
- Use Supabase test helpers to create a pre-authenticated session cookie
- Use `supabase.auth.signInWithPassword()` if a test user with password is configured
The executor will check the actual auth setup and adapt. This is a common E2E testing challenge that's resolved at implementation time.

### S1-5: Phase scope is high

**Disagree — scope is appropriate.** The 4 carry-forward items are contractual obligations that cannot be deferred. The drag-preview ghost and performance budgets are locked user decisions. The review gate is the purpose of Phase 3. The plans are well-decomposed into 7 focused units with clear wave dependencies. Average plan complexity is moderate (1-2 tasks each). The scope concern is noted but doesn't warrant scope reduction.

### S1-6: Stale paths and invalid commands

**Agree — cosmetic, will fix during execution.** The executor resolves path references against the actual codebase. Stale paths in plan text (like `@packages/ecson/src/schemas.ts`) don't affect execution — the executor reads the real files and adapts. Invalid verify commands (like `vitest --filter`) will be replaced with correct workspace commands during execution.

### S1-7: Fixture loading route for E2E

**Agree — will define during execution.** The E2E test needs a way to load a specific golden fixture. Options: (a) create a project via API and load it, (b) use a test route that loads a fixture directly, (c) use the editor's "new project" flow with a template. The executor will choose based on what's most reliable. The plan specifies the golden-path flow (create -> edit -> save -> reload -> verify) which doesn't require fixture-specific loading.

### S1-8: CF resolution coverage

**Partially agree.** The carry-forward items are explicitly assigned to plans:
- CF-P2-01 → 03-01 (adapter tests)
- CF-P2-02 → 03-04 (RLS tests)
- CF-P2-03 → 03-02 (schema migration)
- CF-P2-04 → 03-03 (adapter split)

Each plan has verify commands and must_haves that prove resolution. The risk is execution quality, not plan coverage.

## Response to S2 Findings

### S2-1: Schema contract references

**Agree — cosmetic.** The executor will use actual file paths from the codebase, not the plan's reference paths. The ECSON schema exports are at `packages/ecson/src/schemas/` (directory with multiple schema files), not a single `schemas.ts`. This doesn't affect execution.

### S2-2: Performance budget source file

**Agree — will clarify during execution.** The new `budgets.ts` will be created alongside the existing `benchmarks.ts`. The executor will either:
- Add budget definitions to the existing `benchmarks.ts`
- Create a separate `budgets.ts` that `benchmarks.ts` imports

The choice depends on the existing file structure. Either way, the budgets will be defined and benchmarks updated.

### S2-3: Drag-drop payload assumptions

**Agree — will verify during execution.** The executor will check the actual drag payload format from `asset-browser.tsx` and ensure the DragPreviewManager parses it correctly. The plan correctly identifies the integration point; the exact payload shape will be resolved at implementation time.

### S2-4: __sceneReady sticky semantics

**Agree — good catch.** The executor should implement the scene-ready signal with a sticky flag: if a test navigates to the page after the scene has already loaded, it should be able to check a `window.__sceneReady` boolean rather than waiting for an event that already fired. Will note for the executor.

## Adjustments to Make During Execution

1. **Camera-controller ownership:** Resolve during 03-03 execution based on actual import analysis
2. **Auth in E2E tests:** Use actual auth mechanism, not assumed password login
3. **Test command normalization:** Use `pnpm --filter <package> test` pattern consistently
4. **Preflight in 03-07:** Verify all prerequisite artifacts exist before evidence compilation
5. **Sticky scene-ready:** Implement `window.__sceneReady` flag alongside the CustomEvent
6. **Budget source file:** Integrate with existing `benchmarks.ts` rather than creating separate file if cleaner

## Conclusion

No plan revisions needed. The S0 findings (camera-controller ownership, core handoff risk) are real but are naturally resolved during execution — the wave dependency chain ensures the split is stable before downstream work begins. The S1 findings are mostly execution-time details (auth flow, test commands, file paths) that the executor resolves against the actual codebase. The plans provide correct intent and structure; the executor adapts the specifics.

Proceeding to execution.

# Phase 3 Plan Review — 03-07
Date: 2026-02-20  
Auditor: Codex (gpt-5.3-codex)  
Plan: 03-07-PLAN.md

## Codebase Verification
Skills used: none (task does not match available `skill-creator`/`skill-installer` scopes).

Checked plan references and implementation assumptions against repo files.

**Findings (by severity):**

- **S1** Missing referenced inputs/artifacts needed by this plan as written:
  - `.planning/phases/03-review-gate-foundation/03-01-SUMMARY.md` through `03-06-SUMMARY.md` are missing (plan references them at `.planning/phases/03-review-gate-foundation/03-07-PLAN.md:59` to `.planning/phases/03-review-gate-foundation/03-07-PLAN.md:64`).
  - `scripts/check-adapter-loc.sh` is missing (required at `.planning/phases/03-review-gate-foundation/03-07-PLAN.md:88` and checklist at `.planning/phases/03-review-gate-foundation/03-07-PLAN.md:188`).

- **S2** Architecture drift source is undefined in-repo:
  - Plan asks to check drift against `FOUNDATION.md` (`.planning/phases/03-review-gate-foundation/03-07-PLAN.md:132`), but neither `.planning/FOUNDATION.md` nor `FOUNDATION.md` exists.

- **S2** Budget file reference mismatch:
  - Plan says to reference `budgets.ts` (`.planning/phases/03-review-gate-foundation/03-07-PLAN.md:113`), but current budget source is `packages/conformance/src/benchmarks.ts:17` (`PERFORMANCE_BUDGETS`).

- **S2** Dependency-direction assertion in plan context does not match package manifests:
  - Claimed chain `ecson -> patchops -> canonical-ir -> adapters -> editor` (`.planning/phases/03-review-gate-foundation/03-07-PLAN.md:125`).
  - Actual manifests: `canonical-ir` depends on `ecson` directly (`packages/canonical-ir/package.json:18`), not on `patchops`.

- **S2** Human-checkpoint narrative is ahead of current codebase state:
  - Task text says drag-preview ghost and E2E/visual baseline were built (`.planning/phases/03-review-gate-foundation/03-07-PLAN.md:242`), but no Playwright/E2E files are present and viewport drop code currently handles drop without ghost-preview flow (`apps/editor/src/components/editor/shell/editor-shell.tsx:139`, `apps/editor/src/components/editor/shell/editor-shell.tsx:152`).

- **S3** Verification wording inconsistency:
  - “Verify all 5 review artifacts exist ... Plus PHASE_3_MANUAL_CHECKLIST.md” (`.planning/phases/03-review-gate-foundation/03-07-PLAN.md:217`) actually describes 6 files.

**What matched plan assumptions:**

- `scripts/codex-review.sh` exists and supports `post-review`/`final-review` (`scripts/codex-review.sh:27`, `scripts/codex-review.sh:28`).
- PatchOps safeguards referenced by plan exist:
  - centralized read-only guard (`apps/editor/src/stores/slices/scene-slice.ts:112`)
  - `__environment__` restriction/tests (`packages/patchops/src/validation.ts:47`, `packages/patchops/__tests__/engine.test.ts:552`)
  - approved exceptions documented (`CLAUDE.md:20` to `CLAUDE.md:23`)
- Conformance test surfaces exist for round-trip/lossiness/property/benchmarks:
  - `packages/conformance/__tests__/round-trip.test.ts:30`
  - `packages/conformance/__tests__/lossiness-contract.test.ts:27`
  - `packages/conformance/__tests__/property-tests.test.ts:1`
  - `packages/conformance/__tests__/benchmarks.test.ts:49`
- Adapter boundary is currently respected in code imports:
  - adapter consumes canonical-ir types (`packages/adapter-playcanvas/src/adapter.ts:2`), no adapter imports from ecson/patchops found.

## Feasibility
Conditionally feasible only if plans `03-01` through `03-06` are actually completed first and produce expected outputs. In current repo state, this plan cannot be executed end-to-end due to missing prerequisite summaries and missing `scripts/check-adapter-loc.sh`.

## Completeness
Good coverage of review-gate mechanics (evidence, review loop, decision, manual checklist), but incomplete on source-of-truth references (`FOUNDATION.md`) and concrete artifact paths (`budgets.ts`, missing summaries/script). Task 2 language should be future-conditional, not already-built phrasing.

## Architecture Alignment
Intent aligns with architecture rules (PatchOps integrity, adapter boundary, cumulative debt). Current repo still has a documented rule/manifest mismatch around dependency-direction strictness, so plan should explicitly validate against actual manifests rather than assume strict linear dependency.

## Risk Assessment
Real risks identified in plan are valid. Missing risks:
- prerequisite artifact drift (missing summary/script paths),
- spec-source ambiguity for architecture drift baseline,
- mismatch between documented stack and actual dependency versions (e.g., Zod catalog is `^3.25.0` at `pnpm-workspace.yaml:9`).

## Correctness
Several path/interface references are currently incorrect or stale (missing summaries, missing LoC script, `budgets.ts`, missing `FOUNDATION.md`). Core command references to `codex-review.sh` are correct.

## Test Strategy
Strong in breadth for CI-side evidence (typecheck/lint/test + conformance + PatchOps), but currently blocked by missing LoC script dependency and lacks concrete executable E2E/visual test targets in the current tree. Also, no explicit failure policy if prerequisites are missing before running review loop.

## Summary
- Key concerns:
  - Missing prerequisite files/scripts referenced by this plan.
  - `FOUNDATION.md`/`budgets.ts` references do not match repo reality.
  - Task 2 claims features/tests as already built that are not present in current codebase.
- Recommended adjustments:
  - Add a preflight section that fails fast on missing prerequisites.
  - Replace `budgets.ts` reference with `packages/conformance/src/benchmarks.ts`.
  - Point architecture-drift comparison to an existing file/path.
  - Make Task 2 wording conditional on completion evidence, not assumed completion.
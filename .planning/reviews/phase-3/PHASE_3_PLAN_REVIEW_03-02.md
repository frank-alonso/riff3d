# Phase 3 Plan Review — 03-02
Date: 2026-02-20  
Auditor: Codex (gpt-5.3-codex)  
Plan: 03-02-PLAN.md

## Codebase Verification
- Verified plan file at `.planning/phases/03-review-gate-foundation/03-02-PLAN.md`.
- `SceneDocumentSchema` and `CURRENT_SCHEMA_VERSION` exist and are exported via `@riff3d/ecson`: `packages/ecson/src/schemas/scene-document.ts:9`, `packages/ecson/src/schemas/scene-document.ts:17`, `packages/ecson/src/schemas/index.ts:47`, `packages/ecson/src/index.ts:4`.
- `FogTypeEnum` does **not** include `"none"`: `packages/ecson/src/schemas/environment.ts:12`.
- Plan assumption about invalid fog in patchops tests is correct: `packages/patchops/__tests__/engine.test.ts:36`, `packages/patchops/__tests__/inverse.test.ts:35`.
- Raw ECSON doc construction still exists in patchops target files: `packages/patchops/__tests__/engine.test.ts:8`, `packages/patchops/__tests__/inverse.test.ts:7`.
- Most other listed files are already schema-validated or fixture-driven:
  - `packages/canonical-ir/__tests__/compiler.test.ts:35`
  - `packages/canonical-ir/__tests__/decompiler.test.ts:33`
  - `packages/canonical-ir/__tests__/round-trip.test.ts:82`
  - `packages/conformance/__tests__/replay.test.ts:24`
  - `packages/conformance/__tests__/round-trip.test.ts:31` (uses `@riff3d/fixtures`)
  - `packages/fixtures/src/builders/builder.ts:453`
- **Mismatch:** context file `@packages/ecson/src/schemas.ts` in plan does not exist. Actual schema files are under `packages/ecson/src/schemas/` with barrel at `packages/ecson/src/schemas/index.ts`.
- Additional test files outside `files_modified` still construct/declare raw `SceneDocument` shapes (not all are invalid, but this contradicts “all test files across monorepo”):
  - `packages/ecson/__tests__/schemas.test.ts:433`
  - `packages/ecson/__tests__/schemas.test.ts:32`

## Feasibility
- Feasible overall.
- S1: The bad context path (`packages/ecson/src/schemas.ts`) is a real execution hazard for an autonomous run.
- S2: Scope includes many files that likely need no edits, while true monorepo-wide claim is broader than listed work.

## Completeness
- S1: Plan objective/success says “all test files across the monorepo,” but scope excludes `packages/ecson/__tests__/schemas.test.ts` where raw `SceneDocument` literals remain.
- S2: Verification rules are incomplete; searching only `as SceneDocument` misses key patterns like `function ...(): SceneDocument { return { ... } }` seen in current failures.

## Architecture Alignment
- Mostly aligned with contract-first intent: using `SceneDocumentSchema.parse()` in test document factories is consistent.
- S2: “shared helper in fixtures package” for patchops/canonical tests can create avoidable cross-package coupling/dependency churn; local per-package test helper is cleaner for dependency boundaries.

## Risk Assessment
- Real risks identified:
  - S1: False “CF-P2-03 fully resolved” due monorepo scope mismatch.
  - S2: Weak grep-based verification can pass while raw construction remains.
- Missed risks:
  - S2: Over-migrating intentionally raw schema-shape tests (especially in `ecson`) may reduce negative/shape-focused test coverage.

## Correctness
- S1: Incorrect referenced file path in plan: `packages/ecson/src/schemas.ts` (missing).
- S2: Example mentions `buildSimpleScene` but no such builder exists in fixtures.
- S2: Artifact text for `packages/conformance/__tests__/round-trip.test.ts` implies direct schema parse migration, but file is fixture-based and does not construct raw ECSON documents directly.

## Test Strategy
- Strengths:
  - Running test + typecheck after migration is appropriate.
- Gaps:
  - S2: `grep -r "as SceneDocument"` is insufficient.
  - S2: `grep "SceneDocumentSchema.parse"` can be a false positive and does not prove all constructors migrated.
- Execution note:
  - Could not run `pnpm turbo test` / `pnpm turbo typecheck` in this environment because Turbo attempted to write logs and failed with permission denied (read-only sandbox).

## Summary
- Key concerns:
  - S1: Plan references a non-existent schema file path.
  - S1: “Monorepo-wide fully resolved” claim is not supported by listed scope.
  - S2: Verification commands are not strong enough to prove migration completeness.
  - S2: Potential boundary drift if shared helper is centralized in `@riff3d/fixtures`.
- Recommended adjustments:
  - Update context path to `packages/ecson/src/schemas/index.ts` (or specific schema files).
  - Narrow success criteria to actual scoped packages or explicitly include `ecson` tests in scope.
  - Replace verification grep with stronger patterns for raw constructors (`: SceneDocument`, `function ...(): SceneDocument`, `schemaVersion/rootEntityId/entities` object literals).
  - Prefer local test helpers per package instead of cross-package fixture helper unless dependency changes are explicitly accepted.
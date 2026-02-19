---
phase: 01-contracts-testing-spine
verified: 2026-02-19T17:10:00Z
status: passed
score: 15/15 must-haves verified
re_verification: false
---

# Phase 1: Contracts & Testing Spine Verification Report

**Phase Goal:** All core contracts (PatchOps, ECSON, Canonical IR) are specified, implemented, and proven via golden fixtures with deterministic round-trip tests -- no browser needed. Includes conformance harness, CI pipeline, property-based tests, and a Rapier physics evaluation spike.
**Verified:** 2026-02-19T17:10:00Z
**Status:** PASSED
**Re-verification:** No -- initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | `pnpm install` from root installs all workspace packages without errors | VERIFIED | `pnpm ls -r --depth 0` shows 7 projects, 38 packages, all workspace links resolved: `@riff3d/ecson link:../ecson`, `@riff3d/patchops link:../patchops`, etc. |
| 2 | `pnpm turbo typecheck lint test` passes for all packages | VERIFIED | 21 tasks successful, 21 total. 337 tests pass across 5 packages. All typecheck and lint pass (one non-blocking lint warning noted). |
| 3 | ECSON SceneDocument schema is a complete Zod contract with all child schemas | VERIFIED | `packages/ecson/src/schemas/scene-document.ts` exports `SceneDocumentSchema` and `SceneDocument` type. 11 schema files implemented (vec3, quaternion, transform, component-instance, entity, asset, wiring, environment, game-settings, scene-document, engine-tuning). 30 ecson schema tests pass. |
| 4 | All 16 PatchOp types are defined in a discriminated union with id, timestamp, origin, version fields | VERIFIED | `packages/patchops/src/schemas.ts` defines `PatchOpSchema` as `z.union` of NonBatchPatchOpSchema (15 types via `z.discriminatedUnion`) + BatchOpWithRecursionSchema (using `z.lazy`). 27 schema tests pass covering all 16 op types. |
| 5 | Every PatchOp has an inverse generator; apply-then-inverse returns original document state | VERIFIED | `packages/patchops/src/engine.ts` implements `applyOp` with exhaustive switch on all 16 types, returning inverse. 19 inverse tests pass covering all 16 op types including Reparent sibling order and BatchOp recursion. |
| 6 | Canonical IR is a minimal normalized schema with compiler (ECSON->IR) and decompiler (IR->ECSON) | VERIFIED | `packages/canonical-ir/src/compiler.ts` exports `compile()` with topological sort and O(1) nodeIndex. `packages/canonical-ir/src/decompiler.ts` exports `decompile()`. 9 compiler tests, 5 decompiler tests pass. |
| 7 | Round-trip (ECSON -> IR -> ECSON) preserves the portable subset identically | VERIFIED | `packages/conformance/__tests__/round-trip.test.ts` runs all 7 golden fixtures through full round-trip. 10 round-trip tests pass. 8 canonical-ir round-trip tests pass separately. |
| 8 | The component registry has 17 typed component definitions with editor hints | VERIFIED | `packages/ecson/src/registry/components/` has 17 .ts files (9 core + 8 gameplay). `index.ts` imports all 17. 87 registry tests pass including count checks, schema validation, editor hint presence. |
| 9 | 7 golden fixtures (6 clean + 1 adversarial) all produced by builder API and Zod-validated | VERIFIED | `packages/fixtures/src/builders/` has 7 builder files (transforms-parenting, materials-lights, animation, events-triggers, character-stub, timeline-stub, adversarial). 26 builder tests pass; all 7 produce valid SceneDocuments. |
| 10 | fast-check property tests run 100+ iterations proving apply-inverse, replay determinism, batch equivalence, structural integrity | VERIFIED | `packages/conformance/__tests__/property-tests.test.ts` has 4 `test.prop` tests with `numRuns: 100, seed: 42`. 4 property tests pass (400 total executions). |
| 11 | PatchOps replay determinism proven: same ops on two fresh docs yield identical results | VERIFIED | `packages/conformance/__tests__/replay.test.ts` has 3 tests including adversarial fixture. Replay utilities in `replay.ts` import `applyOps` from `@riff3d/patchops`. All 3 pass. |
| 12 | Circular reparent is rejected by validation | VERIFIED | `packages/patchops/src/validation.ts` exports `validateOp`. `engine.ts` calls `validateOp` before applying. Inverse test suite includes explicit circular reparent rejection test. |
| 13 | CI pipeline runs typecheck, lint, and test on push to main and PRs | VERIFIED | `.github/workflows/ci.yml` triggers on `push: branches: [main]` and `pull_request: branches: [main]`. Runs `pnpm turbo typecheck lint test`. |
| 14 | Performance benchmark infrastructure operational with defined budgets | VERIFIED | `packages/conformance/src/benchmarks.ts` exports `PERFORMANCE_BUDGETS` with compilationTime, decompilationTime, patchOpApply, memoryBaseline budgets. 18 benchmark tests pass. |
| 15 | Rapier physics evaluation spike is documented and referenced | VERIFIED | `.planning/research/RAPIER_SPIKE.md` exists with decision, findings, and test results. Referenced in `packages/conformance/src/index.ts` comment. Physics schemas (RigidBody, Collider) are engine-agnostic per spike. |

**Score:** 15/15 truths verified

---

### Required Artifacts

| Artifact | Provides | Status | Details |
|----------|----------|--------|---------|
| `package.json` | Root workspace with turbo scripts | VERIFIED | Contains `"turbo": "^2.8.10"`, scripts for build/test/typecheck/lint |
| `pnpm-workspace.yaml` | Workspace package discovery | VERIFIED | `packages: [apps/*, packages/*]`, catalog with shared versions, `onlyBuiltDependencies: [esbuild]` |
| `turbo.json` | Turborepo task pipeline | VERIFIED | `build.dependsOn: [^build]`, test/typecheck dependsOn `^build`, lint has no deps |
| `tsconfig.base.json` | Shared strict TypeScript config | VERIFIED | `noUncheckedIndexedAccess: true`, strict, noImplicitReturns, noFallthroughCasesInSwitch, ES2022, bundler resolution |
| `.github/workflows/ci.yml` | GitHub Actions CI pipeline | VERIFIED | pnpm/action-setup@v4, setup-node@v4 (node 22), `pnpm turbo typecheck lint test` |
| `packages/ecson/src/schemas/scene-document.ts` | Root ECSON document schema | VERIFIED | `SceneDocumentSchema` with id, name, schemaVersion, entities, rootEntityId, assets, wiring, environment, gameSettings, metadata |
| `packages/ecson/src/schemas/entity.ts` | Entity schema | VERIFIED | `EntitySchema` with id, name, parentId, children, components, tags, transform, visible, locked, tuning |
| `packages/ecson/src/schemas/engine-tuning.ts` | Engine tuning escape hatch | VERIFIED | `EngineTuningSchema = z.record(z.string(), z.record(z.string(), z.unknown()))` |
| `packages/ecson/src/ids.ts` | nanoid-based ID generators | VERIFIED | Exports `generateEntityId` (16-char), `generateOpId` (21-char nanoid), `generateAssetId` (ast_ prefix), `generateWireId` (wir_ prefix) |
| `packages/ecson/src/migrations/migrate.ts` | Forward migration runner | VERIFIED | Exports `migrateDocument`, `migrations: Migration[]` (empty v1), applies migrations in order, logs warning, validates with Zod |
| `packages/patchops/src/schemas.ts` | PatchOp discriminated union (all 16) | VERIFIED | `PatchOpSchema` = union of NonBatchPatchOpSchema (15 types via discriminatedUnion) + BatchOpWithRecursionSchema (z.lazy) |
| `packages/patchops/src/engine.ts` | applyOp, applyOps with inverse generation | VERIFIED | Exhaustive switch on all 16 op types, calls validateOp first, mutates doc, returns inverse. Exports `applyOp`, `applyOps`. |
| `packages/patchops/src/validation.ts` | Pre-apply validation | VERIFIED | Exports `validateOp`. Checks entity existence, circular reparent detection (ancestor walk). |
| `packages/patchops/src/migrations/migrate-op.ts` | PatchOp format migration runner | VERIFIED | Exports `migrateOp`, `MIGRATION_REGISTRY` (empty v1 Map). Logs warning when migration applies. |
| `packages/canonical-ir/src/types/canonical-scene.ts` | Root Canonical IR scene type | VERIFIED | `CanonicalSceneSchema` with nodes (topologically sorted), nodeIndex (O(1) lookup), rootNodeId, assets, wires, environment |
| `packages/canonical-ir/src/portable-subset.ts` | Portable subset v0 definition | VERIFIED | Exports `PORTABLE_COMPONENT_TYPES` (9 types), `PORTABLE_LIGHT_TYPES`, `PORTABLE_CAMERA_TYPES`, `PORTABLE_MATERIAL_PROPERTIES`, `isPortableComponent`, `isPortableProperty` |
| `packages/canonical-ir/src/compiler.ts` | ECSON -> Canonical IR compiler | VERIFIED | Exports `compile(doc: SceneDocument): CanonicalScene`. BFS topological sort, bakes defaults, builds nodeIndex, validates output. |
| `packages/canonical-ir/src/decompiler.ts` | Canonical IR -> ECSON decompiler | VERIFIED | Exports `decompile`. Restores entity record, parentId/children, components, assets, wires, environment. |
| `packages/ecson/src/registry/registry.ts` | Component registry | VERIFIED | Exports `registerComponent`, `getComponentDef`, `validateComponentProperties`, `listComponents`, `listComponentsByCategory`. 17 components auto-registered on import. |
| `packages/ecson/src/registry/gltf-allowlist.ts` | glTF extension allowlist v0 | VERIFIED | Exports `GLTF_ALLOWLIST`, `isAllowedExtension`, `getPortableExtensions`. 5 extensions classified portable/non-portable. |
| `packages/fixtures/src/builders/builder.ts` | Fluent SceneBuilder + EntityBuilder API | VERIFIED | Exports `SceneBuilder`, `EntityBuilder`. `build()` validates with `SceneDocumentSchema.parse`. Nested fluent API flattens to ECSON entity record. |
| `packages/fixtures/src/builders/adversarial.ts` | Adversarial golden fixture | VERIFIED | 6+ level hierarchy, shared material (3 entities), 3-step event wire chain, empty entities, unicode names, engine tuning sections. |
| `packages/fixtures/src/reference/transforms-parenting.json` | Hand-authored reference fixture | VERIFIED | File exists. Reference equivalence test asserts builder output matches JSON (2 tests pass). |
| `packages/conformance/src/harness.ts` | Conformance test runner | VERIFIED | Exports `runConformanceSuite` returning `ConformanceResult`. Wired to round-trip tests. |
| `packages/conformance/src/round-trip.ts` | Round-trip test utilities | VERIFIED | Exports `testRoundTrip`, `normalizeForComparison`. Imports `compile`, `decompile` from `@riff3d/canonical-ir`. |
| `packages/conformance/src/replay.ts` | Replay determinism utilities | VERIFIED | Exports `testReplayDeterminism`, `generateOpsForFixture`. Imports `applyOps` from `@riff3d/patchops`. |
| `packages/conformance/src/benchmarks.ts` | Performance benchmark runners | VERIFIED | Exports `PERFORMANCE_BUDGETS`, `benchmarkCompilation`, `benchmarkDecompilation`, `benchmarkOpApplication`. Budgets defined for all categories. |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `packages/patchops/package.json` | `packages/ecson` | `workspace:*` dependency | VERIFIED | `"@riff3d/ecson": "workspace:*"` in dependencies. `pnpm ls` shows `@riff3d/ecson link:../ecson`. |
| `packages/canonical-ir/package.json` | `packages/ecson` | `workspace:*` dependency | VERIFIED | `"@riff3d/ecson": "workspace:*"` in dependencies. |
| `turbo.json` | all packages | `^build` dependsOn | VERIFIED | `"build": { "dependsOn": ["^build"] }` ensures topological build order. |
| `packages/patchops/src/engine.ts` | `packages/ecson` | `import.*SceneDocument.*@riff3d/ecson` | VERIFIED | Line 1: `import type { SceneDocument, Entity, ComponentInstance, AssetEntry } from "@riff3d/ecson";` |
| `packages/patchops/src/schemas.ts` | `packages/patchops/src/ops/*.ts` | `z.discriminatedUnion` | VERIFIED | All 15 non-recursive op schemas imported and passed to `z.discriminatedUnion("type", [...])`. |
| `packages/patchops/src/engine.ts` | `packages/patchops/src/validation.ts` | `validateOp` called before mutation | VERIFIED | `engine.ts` line 101: `const validation = validateOp(doc, op);` throws on invalid. |
| `packages/canonical-ir/src/compiler.ts` | `packages/ecson` | `import.*SceneDocument.*@riff3d/ecson` | VERIFIED | Line 1: `import { SceneDocumentSchema, type SceneDocument, ... } from "@riff3d/ecson";` |
| `packages/canonical-ir/src/compiler.ts` | `packages/canonical-ir/src/portable-subset.ts` | `PORTABLE_COMPONENT_TYPES` used | VERIFIED | `portable-subset.ts` is in the same package and exports are available. Portable subset definition used in IR type classification. |
| `packages/fixtures/src/builders/builder.ts` | `packages/ecson` | `SceneDocumentSchema.parse` | VERIFIED | `build()` calls `SceneDocumentSchema.parse()` on final output. |
| `packages/conformance/src/round-trip.ts` | `packages/canonical-ir` | `import.*compile.*@riff3d/canonical-ir` | VERIFIED | Line 2: `import { compile, decompile } from "@riff3d/canonical-ir";` |
| `packages/conformance/src/replay.ts` | `packages/patchops` | `import.*applyOps.*@riff3d/patchops` | VERIFIED | Line 8: `import { applyOps, type PatchOp, CURRENT_PATCHOP_VERSION } from "@riff3d/patchops";` |
| `packages/conformance/__tests__/property-tests.test.ts` | `fast-check` | `test.prop` | VERIFIED | Line 2: `import { test, fc } from "@fast-check/vitest";`. Uses `test.prop([...], { seed: 42, numRuns: 100 })`. |

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| CORE-01 | 01-03 | PatchOps spec fully defined -- deterministic, serializable, ordered, scoped to stable IDs, validatable, invertible | SATISFIED | All 16 ops in discriminated union. `applyOp` returns inverse. `validateOp` gates application. 69 patchops tests pass. |
| CORE-02 | 01-03 | Minimum PatchOps set implemented (16 ops) | SATISFIED | All 16 ops present in `packages/patchops/src/ops/`. 27 schema tests validate each op type. 19 engine tests + 19 inverse tests. |
| CORE-03 | 01-02 | ECSON schema defined with schema version, stable IDs | SATISFIED | `SceneDocumentSchema` with `schemaVersion: z.number().int().min(1)`. Nanoid IDs in `ids.ts`. 30 schema tests pass. |
| CORE-04 | 01-02 | ECSON forward migrations with versioning scaffold | SATISFIED | `migrate.ts` implements `migrateDocument` with `migrations: Migration[]` array (empty v1), version walk, Zod validation, console.warn. 17 migration tests pass. |
| CORE-05 | 01-04 | Canonical IR spec defined -- minimal, normalized, explicit, round-trip safe | SATISFIED | 6 IR schema types in `packages/canonical-ir/src/types/`. Explicit (no defaults), normalized, topologically sorted. 24 type tests pass. |
| CORE-06 | 01-04 | Canonical IR compiler (ECSON -> Canonical IR) implemented | SATISFIED | `compile()` in `compiler.ts` with BFS sort, O(1) nodeIndex, baked defaults. 9 compiler tests pass. |
| CORE-07 | 01-04 | Portable subset v0 defined (scene graph, transforms, mesh refs, PBR, lights, cameras, animation, events) | SATISFIED | `portable-subset.ts` exports `PORTABLE_COMPONENT_TYPES` (9 types), `PORTABLE_MATERIAL_PROPERTIES` (14 properties), `PORTABLE_LIGHT_TYPES`, `PORTABLE_CAMERA_TYPES`, query functions. |
| CORE-08 | 01-02 | Engine tuning/escape hatch schema defined | SATISFIED | `EngineTuningSchema = z.record(z.string(), z.record(z.string(), z.unknown()))` in `engine-tuning.ts`. Present at entity and component level. Round-trip tests assert tuning preserved. |
| CORE-09 | 01-02 | Operation IDs + Entity IDs are globally unique and stable | SATISFIED | `generateEntityId()` (16-char alphanumeric), `generateOpId()` (21-char nanoid), `generateAssetId()` (ast_ + 12-char), `generateWireId()` (wir_ + 12-char). 11 ID tests pass including 1000-collision-free test. |
| CORE-10 | 01-05 | Component registry with schema-driven property definitions | SATISFIED | 17 component definitions (9 core + 8 gameplay stubs), each with Zod schema, defaults, editor hints via `.meta()`, category, singleton flag, events/actions. 87 registry tests pass. |
| TEST-01 | 01-06 | 5-10 golden fixture projects created | SATISFIED | 7 fixtures: transforms-parenting, materials-lights, animation, events-triggers, character-stub, timeline-stub, adversarial. 26 builder tests + 2 reference equivalence tests pass. |
| TEST-02 | 01-06 | Round-trip tests passing (ECSON -> IR -> ECSON for portable subset) | SATISFIED | `conformance/__tests__/round-trip.test.ts` tests all 7 fixtures. 10 tests pass. Additionally 8 canonical-ir round-trip tests pass. |
| TEST-03 | 01-06 | PatchOps replay determinism tests | SATISFIED | `conformance/__tests__/replay.test.ts` has 3 tests (transforms-parenting, adversarial, interleaved ops). All pass. |
| TEST-05 | 01-06 | Performance budgets defined and enforced | SATISFIED | `PERFORMANCE_BUDGETS` object in `benchmarks.ts` with compilationTime (50/200/1000ms), decompilationTime, patchOpApply (1ms single, 50ms batch-100), memoryBaseline. 18 benchmark tests pass. |
| PORT-02 | 01-04 | Portable subset round-trips across ECSON <-> Canonical IR consistently | SATISFIED | Proven by both canonical-ir round-trip tests (8 tests) and conformance round-trip suite (10 tests). Portable subset extraction logic in `round-trip.ts` explicitly strips non-portable fields before comparison. |

**Orphaned requirements check:** TEST-04 is mapped to Phase 4 (Dual Adapter Validation) in REQUIREMENTS.md -- correctly not in Phase 1 plans.

**All 15 Phase 1 requirement IDs (CORE-01..10, TEST-01, TEST-02, TEST-03, TEST-05, PORT-02) satisfied.**

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `packages/patchops/src/engine.ts` | 518 | Unused `eslint-disable` directive (`@typescript-eslint/no-dynamic-delete`) | Info | Lint warning only (0 errors). Known from phase review, tracked as CF-05 carry-forward for Phase 2. No functional impact. |

No placeholder returns, stub implementations, TODO/FIXME comments blocking goal, or wiring red flags found.

---

### Human Verification Required

None. All phase goal criteria are verifiable programmatically:

- Monorepo scaffold: verified by `pnpm ls` and file existence checks.
- Tests passing: verified by `pnpm turbo typecheck lint test` (21/21 tasks, 337/337 tests).
- Contract correctness: verified by substantive code reading and test coverage.
- Round-trip fidelity: verified by automated deterministic comparison.
- CI pipeline: verified by YAML file inspection.

---

### Gaps Summary

No gaps. All 15 must-haves verified at all three levels (exists, substantive, wired).

**Four carry-forward conditions from Phase 1 gate review (PASS_WITH_CONDITIONS) are documented for Phase 2:**
- CF-01: Nightly property tests with rotating seeds
- CF-02: Lossiness contract tests for stripped fields
- CF-03: Mutation-bypass enforcement (lint rule + negative test)
- CF-05: Remove unused eslint-disable directive at `engine.ts:518`

These are Phase 2 obligations, not Phase 1 gaps. The Phase 1 gate decision is PASS_WITH_CONDITIONS as recorded in `.planning/reviews/phase-01/PHASE_01_DECISION.md`.

---

_Verified: 2026-02-19T17:10:00Z_
_Verifier: Claude (gsd-verifier)_

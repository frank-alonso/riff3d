# Phase 4 Evidence

**Date:** 2026-02-20
**Owner:** Claude (Driver)
**Phase:** 4 — Dual Adapter Validation

## Scope

**Planned:**
- Babylon.js adapter implementation from Canonical IR (ADPT-02)
- Incremental delta update system for both adapters (ADPT-03)
- Engine switching UI with camera preservation (PORT-03)
- Engine tuning in inspector (ADPT-04)
- Cross-adapter conformance testing with tolerance bands (TEST-04)
- Phase review and gate decision

**Completed:**
- All 4 delivery plans (04-01 through 04-04) executed successfully
- 04-05 (review gate) in progress

**Requirement IDs:** ADPT-02, ADPT-03, ADPT-04, TEST-04, PORT-03

### Success Criteria Verification

| # | Criterion | Status | Evidence |
|---|-----------|--------|----------|
| 1 | All golden fixtures render on both engines within tolerance | PASS | 34 conformance tests (17 PlayCanvas + 17 Babylon) across all 7 golden fixtures pass. Per-fixture tolerance bands defined. |
| 2 | User can switch between engines with consistent scene | PASS | Engine switcher in top bar with confirmation dialog. Camera serialization/restoration. Selection reset on switch. |
| 3 | Property edits use incremental delta (not full rebuild) | PASS | computeDelta() maps 15 PatchOp types to IRDelta. Both adapters implement applyDelta(). Delta-aware viewport subscriber routes to applyDelta vs rebuildScene. |
| 4 | Engine tuning respected by target adapter, ignored by other | PASS | EngineTuningSection in inspector shows active engine tuning. Peek toggle shows other engine read-only. Entity-level tuning in ECSON schema. |

## Contract Diffs

### PatchOps
- **No changes.** PatchOps contract unchanged. computeDelta() accepts PatchOpLike shape to avoid coupling.

### ECSON
- **Non-breaking addition:** `metadata.preferredEngine` field for project-level engine persistence. Written via system-level mutation (matching loadProject/playtest stop exception pattern).

### Canonical IR
- **New exports (non-breaking):**
  - `EngineAdapter` interface (extracted from adapter-playcanvas to canonical-ir)
  - `SerializedCameraState` type for camera transfer between engines
  - `IRDelta` discriminated union (node-transform, node-visibility, component-property, environment, full-rebuild)
  - `computeDelta()` function mapping PatchOps to IRDelta
- **tsconfig change:** Added `"DOM"` to canonical-ir lib array for HTMLCanvasElement reference in EngineAdapter interface
- **Breaking changes:** None. All additions are new exports.

### Registry
- **No changes.** Component registry unchanged.

## Tests

### Unit/Integration Test Results

All 12 packages pass typecheck and tests:

| Package | Test Files | Tests Passed | Tests Skipped |
|---------|-----------|-------------|---------------|
| @riff3d/ecson | 6 | 159 | 0 |
| @riff3d/patchops | 5 (+1 skipped file) | 80 | 4 |
| @riff3d/canonical-ir | 5 | 70 | 0 |
| @riff3d/fixtures | 2 | 28 | 0 |
| @riff3d/adapter-playcanvas | 12 | 157 | 0 |
| @riff3d/adapter-babylon | 5 | 71 | 0 |
| @riff3d/conformance | 7 | 112 | 6 |
| @riff3d/editor | 1 | 13 | 0 |
| **TOTAL** | **43** | **690** | **10** |

**Skipped tests:**
- patchops: 4 skipped (Supabase integration tests — require env vars, expected in local)
- conformance: 6 skipped (cross-engine visual comparison — advisory only, per-engine baselines are required CI)

### New Tests Added in Phase 4

| Category | Count | Description |
|----------|-------|-------------|
| Babylon adapter unit | 45 | Scene builder (9), component mappers (27), environment (9) |
| Babylon delta | 17 | All delta types: transform, visibility, material, light, camera, environment |
| PlayCanvas delta | 14 | All delta types matching Babylon coverage |
| computeDelta mapper | 24 | All 15 PatchOp types mapped to correct IRDelta variants |
| PlayCanvas conformance | 17 | All 7 golden fixtures: loadScene, rebuildScene, applyDelta, dispose |
| Babylon conformance | 17 | All 7 golden fixtures: loadScene, rebuildScene, applyDelta, dispose |
| PlayCanvas property | 9 | Multi-seed (42, 123, 456) x 3 invariants (entity count, delta safety, rebuild idempotency) |
| Babylon property | 9 | Multi-seed (42, 123, 456) x 3 invariants |
| **Total new** | **152** | From 538 pre-phase to 690 total |

### Property-Based Tests

Multi-seed property testing with fast-check:
- **Seeds:** 42, 123, 456 (deterministic, CI-reproducible)
- **Iterations:** 50 per seed (150 total per adapter)
- **Invariants tested:**
  1. Entity count matches scene.nodes.length after loadScene
  2. applyDelta with transform does not throw
  3. rebuildScene is idempotent (entity count unchanged)
- **Both adapters pass all seeds.**

### Golden Fixture Conformance

All 7 golden fixtures tested on both adapters:

| Fixture | PlayCanvas | Babylon | Status |
|---------|-----------|---------|--------|
| hello-world | PASS | PASS | Basic entity + camera |
| transforms | PASS | PASS | Position/rotation/scale |
| primitives | PASS | PASS | All 7 primitive types |
| materials-lights | PASS | PASS | PBR + 3 light types |
| hierarchy | PASS | PASS | Parent/child trees |
| animation-events | PASS | PASS | Event wires |
| adversarial | PASS | PASS | Deep hierarchy, shared materials |

### Visual Regression

Per-fixture tolerance bands defined in `apps/editor/e2e/fixtures/tolerance-bands.ts`:

| Fixture | Max Diff Pixels | Max Color Delta | Notes |
|---------|----------------|-----------------|-------|
| hello-world | 2% | 0.05 | Simple scene |
| transforms | 3% | 0.05 | Transform-only |
| primitives | 5% | 0.08 | 7 primitive types |
| materials-lights | 8% | 0.15 | Spot light inner cone tolerance |
| hierarchy | 3% | 0.05 | Tree structure |
| animation-events | 5% | 0.10 | Event wires |
| adversarial | 8% | 0.10 | Complex scene |

**Status:** Visual regression promoted from non-blocking beta (Phase 3) to required CI with per-fixture precision. Cross-engine comparison is advisory only (not CI blocking) since engines will always have some visual differences.

**Spot light tolerance note:** The materials-lights fixture has a wider tolerance (0.15 color delta) to account for Babylon's exponent-based spot light inner cone approximation vs PlayCanvas's direct innerConeAngle mapping. This is documented and accepted.

## Performance

### LoC Budget

| Adapter | Core LoC | Budget | Status |
|---------|---------|--------|--------|
| PlayCanvas | 1295 | 1500 | PASS (86%) |
| Babylon | 1182 | 1500 | PASS (79%) |

Script: `scripts/check-adapter-loc.sh` validates both adapters.

### Compilation/Test Performance

| Metric | Value |
|--------|-------|
| Full test suite (`pnpm turbo run test`) | ~12s (with cache misses) |
| Full typecheck (`pnpm turbo run typecheck`) | ~8s |
| Property tests (per adapter) | ~10s (3 seeds x 50 iterations) |
| Conformance tests (both adapters) | <1s |

No performance regressions detected. Conformance benchmarks maintain Phase 1 budgets (50/200/1000ms for small/medium/large fixtures).

### CI Evidence

**CF-P3-01 (Attach CI run URLs):** `gh` CLI is not available in this execution environment. CI runs on GitHub Actions with `pnpm turbo run test lint typecheck`. Test results verified locally with identical commands. CI URL attachment deferred to when `gh` CLI is available or manual verification.

## Carry-Forward Item Status

| ID | Description | Status | Evidence |
|----|-------------|--------|----------|
| CF-P3-01 | Attach CI run URLs + test artifacts to evidence | PARTIAL | Local test evidence provided. `gh` CLI unavailable for CI URLs. Carry forward to Phase 5. |
| CF-P3-02 | Promote visual regression to required CI with per-fixture tolerance bands | DONE | `apps/editor/e2e/fixtures/tolerance-bands.ts`, `apps/editor/playwright.config.ts` updated |
| CF-P3-03 | Multi-seed property suite (3 seeds x 50 iterations) | DONE | `packages/adapter-playcanvas/__tests__/property-tests.test.ts`, `packages/adapter-babylon/__tests__/property-tests.test.ts` |
| CF-P3-04 | Mechanical mutation-boundary enforcement | ASSESSED | No mechanical enforcement added in Phase 4. Existing pattern: centralized `dispatchOp()` with `isReadOnly` guard. All PatchOps flow through this single entry point. Recommend adding no-restricted-imports lint rule in Phase 5 to prevent direct ECSON mutation. Carry forward. |

## Pre-Execution Review Summary

Pre-execution review was completed (advisory, as Phase 4 is a standard delivery phase):
- `PHASE_4_PLAN_SUMMARY.md` — published
- 5 per-plan reviews (`PHASE_4_PLAN_REVIEW_04-01.md` through `04-05`) — completed by Codex
- Synthesis review (`PHASE_4_PLAN_REVIEW.md`) — completed by Codex
- Response (`PHASE_4_PLAN_REVIEW_RESPONSE.md`) — all findings addressed

Key findings from pre-execution review and their resolution:
1. **S0: HTMLCanvasElement in canonical-ir** — Resolved: DOM lib added to canonical-ir tsconfig (documented as appropriate since adapters are inherently DOM-bound)
2. **S0: Preconditions not enforced** — Resolved: GSD executor enforces sequential plan execution with typecheck+test verification between plans
3. **S1: PatchOps payload assumptions** — Resolved: computeDelta uses PatchOpLike interface, verified against actual contract during 04-02
4. **S1: Metadata persistence path** — Resolved: Direct mutation for system-level metadata (approved exception pattern)
5. **S1: Tuning contract** — Resolved: Entity-level tuning exists in ECSON schema; scene-level via environment panel

## Risks and Deferrals

### Known Gaps
1. **Babylon editor tools:** Gizmos, selection, grid, and drag preview only work with PlayCanvas. When Babylon is active, editing is via inspector/hierarchy panels only. Babylon editor tools are Phase 5+ scope.
2. **Cross-engine visual comparison:** Advisory only (not CI blocking). Cross-engine pixel-perfect rendering is not a goal — per-engine baseline stability is.
3. **CF-P3-01 partial:** CI URLs not attachable without `gh` CLI. Test evidence provided locally.

### Deferred Work
- CF-P3-04: Mechanical mutation-boundary enforcement (lint rule) — carry to Phase 5
- CF-P3-01: CI URL attachment — carry to Phase 5 (when `gh` CLI available)
- Babylon editor tools (gizmos, selection, grid) — Phase 5+ scope
- Play-mode engine hot-swap — future enhancement

## Decisions Requested

None. All architectural decisions were resolved during execution per the pre-execution review response.

## Phase 4 Commit History

| Commit | Type | Description |
|--------|------|-------------|
| 63e3031 | feat(04-01) | Extract EngineAdapter interface and IRDelta type to canonical-ir |
| 20927c1 | feat(04-01) | Create @riff3d/adapter-babylon with full scene rendering |
| 9416559 | feat(04-02) | Implement computeDelta mapper and adapter delta handlers |
| 4ea628f | feat(04-02) | Scene-slice delta integration and comprehensive delta tests |
| 03648c4 | feat(04-03) | Engine state slice, viewport generalization, delta-aware switching |
| 1dc208f | feat(04-03) | Engine switcher UI, confirmation dialog, and engine tuning inspector |
| 1121b1a | feat(04-04) | Cross-adapter conformance harness, property tests, LoC budget enforcement |
| 9c09f20 | feat(04-04) | Visual regression with per-fixture tolerance bands |

---
*Evidence compiled: 2026-02-20*
*Owner: Claude (Driver)*

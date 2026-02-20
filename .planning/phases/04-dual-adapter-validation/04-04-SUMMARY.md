---
phase: 04-dual-adapter-validation
plan: 04
subsystem: testing
tags: [conformance, visual-regression, property-testing, fast-check, playwright, adapter-validation, loc-budget]

# Dependency graph
requires:
  - phase: 04-02
    provides: "Delta-aware adapters (applyDelta, computeDelta)"
  - phase: 04-03
    provides: "Viewport engine switching (switchEngine, BabylonAdapter live)"
provides:
  - "Cross-adapter conformance harness (runAdapterConformance) validating both adapters against all golden fixtures"
  - "Multi-seed property tests (3 seeds x 50 iterations) for both adapters"
  - "Per-fixture visual regression tolerance bands for dual-engine visual testing"
  - "Dual-adapter Playwright visual tests for all 7 golden fixtures on both engines"
  - "CI-enforced LoC budget for both adapter cores (check-adapter-loc.sh)"
affects: [04-05, phase-06, phase-07]

# Tech tracking
tech-stack:
  added: [fast-check (adapter packages), @fast-check/vitest (adapter packages)]
  patterns: [multi-seed property testing, per-fixture tolerance bands, cross-adapter conformance harness]

key-files:
  created:
    - packages/conformance/src/adapter-conformance.ts
    - packages/conformance/__tests__/helpers/adapter-test-helpers.ts
    - packages/conformance/__tests__/playcanvas-conformance.test.ts
    - packages/conformance/__tests__/babylon-conformance.test.ts
    - packages/adapter-playcanvas/__tests__/property-tests.test.ts
    - packages/adapter-babylon/__tests__/property-tests.test.ts
    - apps/editor/e2e/fixtures/tolerance-bands.ts
    - apps/editor/e2e/visual/dual-adapter.visual.ts
  modified:
    - packages/conformance/src/index.ts
    - packages/conformance/package.json
    - packages/adapter-playcanvas/package.json
    - packages/adapter-babylon/package.json
    - scripts/check-adapter-loc.sh
    - apps/editor/playwright.config.ts
    - apps/editor/e2e/visual/fixture-render.visual.ts

key-decisions:
  - "Conformance package gets playcanvas + @babylonjs/core as devDependencies so vi.mock resolves correctly across monorepo boundaries"
  - "Per-fixture tolerance bands replace Phase 3 generic beta thresholds; visual regression promoted to required CI"
  - "Spot light inner cone tolerance (0.15 color delta) explicitly documented as acceptable engine difference"
  - "Cross-engine visual comparison is advisory only (not CI blocking); per-engine baselines are required"
  - "Property tests use 3 seeds (42, 123, 456) x 50 iterations for CI reproducibility with diverse coverage"

patterns-established:
  - "Cross-adapter conformance pattern: runAdapterConformance(adapter, name, scene) -> result with pass/fail and entity counts"
  - "Multi-seed property testing pattern: for (seed of [42, 123, 456]) { test.prop with numRuns=50 }"
  - "Per-fixture tolerance bands: TOLERANCE_BANDS record keyed by fixture name with maxDiffPixels + maxColorDelta"

requirements-completed: [ADPT-04, TEST-04]

# Metrics
duration: 7min
completed: 2026-02-20
---

# Phase 4 Plan 4: Conformance Testing Summary

**Cross-adapter conformance harness validating both PlayCanvas and Babylon adapters against all 7 golden fixtures, with multi-seed property tests and per-fixture visual regression tolerance bands**

## Performance

- **Duration:** 7 min
- **Started:** 2026-02-20T19:30:21Z
- **Completed:** 2026-02-20T19:37:44Z
- **Tasks:** 2
- **Files modified:** 16

## Accomplishments

- All 7 golden fixtures pass unit-level conformance on both PlayCanvas and Babylon adapters (loadScene, rebuildScene, applyDelta, dispose)
- Multi-seed property tests (3 seeds x 50 iterations = 150 runs per adapter) verify adapter invariants: entity count correctness, delta safety, rebuild idempotency
- Per-fixture tolerance bands define precise visual thresholds for dual-engine comparison, with spot light inner cone explicitly documented
- Visual regression promoted from Phase 3 non-blocking beta to required CI with per-fixture precision
- LoC budget enforcement script updated to validate both adapter cores (PlayCanvas: 1295/1500, Babylon: 1182/1500)

## Task Commits

Each task was committed atomically:

1. **Task 1: Cross-adapter conformance harness and unit tests** - `1121b1a` (feat)
2. **Task 2: Visual regression with per-fixture tolerance bands** - `9c09f20` (feat)

## Files Created/Modified

- `packages/conformance/src/adapter-conformance.ts` - Generic conformance runner testing EngineAdapter contract
- `packages/conformance/__tests__/helpers/adapter-test-helpers.ts` - Shared helpers: fixture loading, DOM stubs, mock canvas
- `packages/conformance/__tests__/playcanvas-conformance.test.ts` - PlayCanvas conformance: 17 tests across 7 fixtures
- `packages/conformance/__tests__/babylon-conformance.test.ts` - Babylon conformance: 17 tests across 7 fixtures
- `packages/adapter-playcanvas/__tests__/property-tests.test.ts` - Multi-seed property tests (9 tests, 3 seeds x 3 properties)
- `packages/adapter-babylon/__tests__/property-tests.test.ts` - Multi-seed property tests (9 tests, 3 seeds x 3 properties)
- `apps/editor/e2e/fixtures/tolerance-bands.ts` - Per-fixture tolerance definitions with spot light documentation
- `apps/editor/e2e/visual/dual-adapter.visual.ts` - Dual-engine Playwright visual regression tests
- `apps/editor/e2e/visual/fixture-render.visual.ts` - Updated to use per-fixture tolerance bands
- `apps/editor/playwright.config.ts` - Promoted visual regression to required CI
- `scripts/check-adapter-loc.sh` - Extended to validate both adapter cores against 1500 LoC budget
- `packages/conformance/package.json` - Added adapter devDependencies (playcanvas, @babylonjs/core)
- `packages/adapter-playcanvas/package.json` - Added fast-check devDependencies
- `packages/adapter-babylon/package.json` - Added fast-check devDependencies
- `packages/conformance/src/index.ts` - Exported runAdapterConformance
- `pnpm-lock.yaml` - Lockfile update for new devDependencies

## Decisions Made

- **Conformance package devDependencies:** Added `playcanvas` and `@babylonjs/core` as devDependencies to the conformance package so that `vi.mock("playcanvas")` resolves correctly in vitest. Without this, pnpm's strict dependency isolation prevents the mock from being applied to transitive imports through the adapter packages.
- **DOM stubs include document.addEventListener:** Added `document.addEventListener` to globalThis stubs because the real PlayCanvas Keyboard constructor calls `document.addEventListener` during initialization even when the Application class is mocked (the mock only replaces top-level exports, not internal usage).
- **Per-fixture tolerance precision:** Materials-lights fixture uses 0.15 maxColorDelta (wider than the 0.05-0.10 range of other fixtures) specifically to account for Babylon's exponent-based spot light inner cone approximation.
- **Cross-engine comparison advisory:** Marked cross-engine tests as `test.skip` (advisory) since engines will always have some visual differences. Per-engine baselines are what matters for CI.
- **Property test seed selection:** Seeds 42, 123, 456 chosen to provide diverse but reproducible coverage. 50 iterations per seed balances CI speed (total ~10s per adapter) with coverage depth.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added playcanvas and @babylonjs/core to conformance devDependencies**
- **Found during:** Task 1 (conformance test execution)
- **Issue:** `vi.mock("playcanvas")` in conformance test file did not apply to transitive imports from `@riff3d/adapter-playcanvas` due to pnpm's strict dependency isolation. The real PlayCanvas Keyboard constructor was called, failing on `document.addEventListener`.
- **Fix:** Added `playcanvas: ~2.16.0` and `@babylonjs/core: ~8.52.0` to conformance package devDependencies so vitest can resolve the mock path.
- **Files modified:** packages/conformance/package.json
- **Verification:** All 34 conformance tests pass (17 PlayCanvas + 17 Babylon)
- **Committed in:** 1121b1a (Task 1 commit)

**2. [Rule 3 - Blocking] Added document.addEventListener to DOM stubs**
- **Found during:** Task 1 (PlayCanvas conformance test execution)
- **Issue:** globalThis.document stub lacked `addEventListener`, causing PlayCanvas Keyboard initialization to fail even with mocked Application.
- **Fix:** Added `addEventListener: vi.fn()` and `removeEventListener: vi.fn()` to the document stub in adapter-test-helpers.ts.
- **Files modified:** packages/conformance/__tests__/helpers/adapter-test-helpers.ts
- **Verification:** PlayCanvas adapter initialization succeeds in conformance tests
- **Committed in:** 1121b1a (Task 1 commit)

---

**Total deviations:** 2 auto-fixed (2 blocking)
**Impact on plan:** Both auto-fixes were necessary for cross-package test resolution in pnpm monorepo. No scope creep.

## Issues Encountered

None beyond the auto-fixed blocking issues above.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Conformance harness validated: both adapters produce consistent results for all golden fixtures
- Property tests provide ongoing invariant protection against adapter regressions
- Visual regression infrastructure ready for Phase 5+ with per-fixture precision
- Carry-forward items resolved: CF-P3-02 (visual regression promoted), CF-P3-03 (multi-seed property tests added)
- 04-05 (final Phase 4 plan) can proceed with evidence packet and review gate

## Self-Check: PASSED

- All 9 key files verified present on disk
- Both task commits (1121b1a, 9c09f20) verified in git log
- Conformance tests: 112 passed, 6 skipped (7 test files)
- PlayCanvas adapter tests: 157 passed (12 test files)
- Babylon adapter tests: 71 passed (5 test files)
- LoC budget: PlayCanvas 1295/1500 PASS, Babylon 1182/1500 PASS

---
*Phase: 04-dual-adapter-validation*
*Completed: 2026-02-20*

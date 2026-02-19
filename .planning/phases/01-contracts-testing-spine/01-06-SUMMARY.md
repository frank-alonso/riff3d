---
phase: 01-contracts-testing-spine
plan: 06
subsystem: testing
tags: [fixtures, conformance, round-trip, replay, fast-check, property-tests, benchmarks, golden-fixtures]

# Dependency graph
requires:
  - phase: 01-03
    provides: "PatchOps engine with 16 op types, apply/inverse, and applyOps"
  - phase: 01-04
    provides: "Canonical IR compiler/decompiler for ECSON round-trip"
  - phase: 01-05
    provides: "Component registry with 17 typed definitions for fixture authoring"
provides:
  - "Fluent SceneBuilder + EntityBuilder API for constructing ECSON documents with deterministic IDs"
  - "7 golden fixtures (6 clean + 1 adversarial) covering transforms, materials, lights, animation, events, character, timeline"
  - "Hand-authored reference fixture for format documentation with builder equivalence test"
  - "Conformance harness running round-trip tests on fixture suites"
  - "Round-trip proof: all 7 fixtures survive ECSON -> IR -> ECSON"
  - "Replay determinism proof: same ops on fresh docs produce identical results"
  - "fast-check property tests proving apply-inverse identity, replay determinism, batch equivalence, structural integrity"
  - "Performance benchmark infrastructure with defined budgets for compilation, decompilation, op application"
affects: [01-07, phase-02, phase-07, all-future-phases]

# Tech tracking
tech-stack:
  added: ["fast-check", "@fast-check/vitest", "@types/node"]
  patterns: [fluent-builder-api, deterministic-id-generation, round-trip-testing, replay-determinism, property-based-testing, performance-budgets]

key-files:
  created:
    - packages/fixtures/src/builders/builder.ts
    - packages/fixtures/src/builders/transforms-parenting.ts
    - packages/fixtures/src/builders/materials-lights.ts
    - packages/fixtures/src/builders/animation.ts
    - packages/fixtures/src/builders/events-triggers.ts
    - packages/fixtures/src/builders/character-stub.ts
    - packages/fixtures/src/builders/timeline-stub.ts
    - packages/fixtures/src/builders/adversarial.ts
    - packages/fixtures/src/builders/index.ts
    - packages/fixtures/src/reference/transforms-parenting.json
    - packages/fixtures/__tests__/builders.test.ts
    - packages/fixtures/__tests__/reference-equivalence.test.ts
    - packages/conformance/src/harness.ts
    - packages/conformance/src/round-trip.ts
    - packages/conformance/src/replay.ts
    - packages/conformance/src/benchmarks.ts
    - packages/conformance/__tests__/round-trip.test.ts
    - packages/conformance/__tests__/replay.test.ts
    - packages/conformance/__tests__/property-tests.test.ts
    - packages/conformance/__tests__/benchmarks.test.ts
  modified:
    - packages/fixtures/src/index.ts
    - packages/conformance/src/index.ts
    - packages/conformance/package.json
    - packages/conformance/tsconfig.json

key-decisions:
  - "Builder uses nested fluent API internally but flattens to ECSON's entity record format on build(), with SceneDocumentSchema.parse() validation"
  - "Deterministic IDs via counter-based generators with seed prefix for test reproducibility"
  - "Round-trip comparison uses portable subset extraction (strips tags, locked, metadata, component tuning) since IR doesn't carry these fields"
  - "fast-check uses fc.stringMatching() for entity ID generation (fc.stringOf removed in v4.x)"
  - "Property tests use fixed seed=42 with 100 iterations for CI reproducibility"
  - "Performance budgets use 2x CI margin since CI machines vary in performance"
  - "Benchmarks run as regular tests (not vitest bench mode) for simplicity in Phase 1"

patterns-established:
  - "Fluent builder pattern: SceneBuilder.create().addEntity().addChild().addComponent().done().build()"
  - "Golden fixture suite: 6 clean fixtures covering distinct feature areas + 1 adversarial for edge cases"
  - "Reference equivalence: hand-authored JSON + builder output comparison for format documentation"
  - "Round-trip testing: compile to IR then decompile, compare portable subset with sorted-key normalization"
  - "Replay determinism: apply same ops to fresh docs, verify identical output"
  - "Property-based testing: model-based op generation tracking which entities exist for valid op sequences"
  - "Performance budget tracking: baselines with CI-safe margins for regression detection"

requirements-completed: [TEST-01, TEST-02, TEST-03, TEST-05]

# Metrics
duration: 41min
completed: 2026-02-19
---

# Phase 1 Plan 6: Fixtures & Conformance Summary

**7 golden fixtures via fluent builder API, conformance harness with round-trip proof for all fixtures, replay determinism, fast-check property tests (4 invariants x 100 iterations), and performance benchmark infrastructure -- 63 new tests passing**

## Performance

- **Duration:** 41 min
- **Started:** 2026-02-19T22:24:36Z
- **Completed:** 2026-02-19T23:05:27Z
- **Tasks:** 3
- **Files modified:** 24

## Accomplishments
- Fluent SceneBuilder + EntityBuilder API with deterministic ID generation for constructing ECSON documents
- 7 golden fixtures: transforms-parenting, materials-lights, animation, events-triggers, character-stub, timeline-stub, and adversarial (deep hierarchy, unicode names, shared materials, event chains, max components, engine tuning)
- Hand-authored reference JSON for transforms-parenting with builder equivalence test
- Conformance harness with round-trip testing: all 7 fixtures pass ECSON -> IR -> ECSON round-trip
- Replay determinism proven: same PatchOps applied to fresh docs produce identical results
- fast-check property tests (seed=42, 100 iterations each): apply-inverse identity, replay determinism, batch equivalence, structural integrity
- Performance benchmark infrastructure with budgets for compilation, decompilation, and op application
- Full monorepo green: 337 total tests across 5 packages (19 turbo tasks)

## Task Commits

Each task was committed atomically:

1. **Task 1: Implement builder API and create 7 golden fixtures with hand-authored reference** - `f711c97` (feat)
2. **Task 2: Implement conformance harness, round-trip tests, replay determinism, and fast-check property tests** - `129b0cc` (feat)
3. **Task 3: Implement performance benchmark infrastructure and document Rapier spike reference** - `ff30e82` (feat)

## Files Created/Modified
- `packages/fixtures/src/builders/builder.ts` - SceneBuilder + EntityBuilder fluent API with deterministic ID generators
- `packages/fixtures/src/builders/transforms-parenting.ts` - Fixture: 3-level hierarchy with varied transforms
- `packages/fixtures/src/builders/materials-lights.ts` - Fixture: shared materials, 3 light types, PBR properties
- `packages/fixtures/src/builders/animation.ts` - Fixture: animation component with clips and keyframes
- `packages/fixtures/src/builders/events-triggers.ts` - Fixture: event wiring, 3-step chain, gameplay components
- `packages/fixtures/src/builders/character-stub.ts` - Fixture: character with physics, checkpoints, platforms
- `packages/fixtures/src/builders/timeline-stub.ts` - Fixture: multi-track timeline with 3 entities, shared duration
- `packages/fixtures/src/builders/adversarial.ts` - Fixture: 7-level deep, unicode names, max components, tuning
- `packages/fixtures/src/builders/index.ts` - Barrel exports for all builders and fixtures
- `packages/fixtures/src/reference/transforms-parenting.json` - Hand-authored reference JSON
- `packages/fixtures/src/index.ts` - Updated barrel with all fixture exports
- `packages/fixtures/__tests__/builders.test.ts` - 26 builder validation tests
- `packages/fixtures/__tests__/reference-equivalence.test.ts` - 2 reference equivalence tests
- `packages/conformance/src/harness.ts` - Conformance suite runner with per-fixture results
- `packages/conformance/src/round-trip.ts` - Round-trip testing with portable subset extraction
- `packages/conformance/src/replay.ts` - Replay determinism + op generator from fixtures
- `packages/conformance/src/benchmarks.ts` - Performance benchmarks with budget definitions
- `packages/conformance/src/index.ts` - Updated barrel with all exports + Rapier spike reference
- `packages/conformance/__tests__/round-trip.test.ts` - 10 round-trip tests (all 7 fixtures + harness)
- `packages/conformance/__tests__/replay.test.ts` - 3 replay determinism tests
- `packages/conformance/__tests__/property-tests.test.ts` - 4 property tests (100 iterations each)
- `packages/conformance/__tests__/benchmarks.test.ts` - 18 benchmark tests
- `packages/conformance/package.json` - Added ecson dependency, fast-check, @types/node
- `packages/conformance/tsconfig.json` - Added ecson reference

## Decisions Made
- **Builder flattens on build():** EntityBuilder tracks tree structure via nested addChild() calls but SceneBuilder.build() produces flat entity Record matching ECSON format, with SceneDocumentSchema.parse() validation ensuring correctness.
- **Deterministic ID generation:** Counter-based with seed prefix (e.g., "txpar_0001000000") for fully reproducible fixtures. Enables hand-authored reference JSON to match builder output exactly.
- **Portable subset for round-trip comparison:** Tags, locked, metadata, and component tuning are stripped before comparison since IR doesn't carry these fields. This matches the documented portable subset boundary from Plan 01-04.
- **fc.stringMatching instead of fc.stringOf:** fast-check v4.x removed fc.stringOf; used fc.stringMatching(/^[0-9a-z]{16}$/) for entity ID generation in property tests.
- **Fixed seed property tests:** seed=42 with 100 numRuns ensures CI reproducibility. Random seeds can be used locally for discovery.
- **Performance budgets with 2x CI margin:** Small (50ms), medium (200ms), large (1000ms) baselines. Tests assert under 2x budget to account for CI machine variance. Budgets are trend baselines, not hard gates.
- **Benchmarks as regular tests:** Using vitest test runner instead of bench mode for Phase 1 simplicity. Can migrate to vitest bench in Phase 7 when latency budgets matter more.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Fixed fc.stringOf not available in fast-check v4.x**
- **Found during:** Task 2 (property tests)
- **Issue:** fast-check v4.5.3 removed `fc.stringOf`, which was used for entity ID generation in the plan
- **Fix:** Used `fc.stringMatching(/^[0-9a-z]{16}$/)` as replacement
- **Files modified:** packages/conformance/__tests__/property-tests.test.ts
- **Verification:** All 4 property tests pass with 100 iterations each
- **Committed in:** 129b0cc (Task 2 commit)

**2. [Rule 3 - Blocking] Fixed test.prop callback destructuring for @fast-check/vitest API**
- **Found during:** Task 2 (property tests)
- **Issue:** `test.prop([arb])(name, ([ops]) => ...)` was destructuring the PatchOp[] instead of receiving it. @fast-check/vitest passes tuple elements as positional args, not as a single array.
- **Fix:** Changed `([ops])` to `(ops)` in all 4 property test callbacks
- **Files modified:** packages/conformance/__tests__/property-tests.test.ts
- **Verification:** All property tests pass
- **Committed in:** 129b0cc (Task 2 commit)

**3. [Rule 3 - Blocking] Added @types/node for benchmark Node.js globals**
- **Found during:** Task 3 (benchmarks)
- **Issue:** TypeScript couldn't find `process.memoryUsage()` and `performance.now()` -- the base tsconfig uses lib: ["ES2022"] which doesn't include Node.js globals
- **Fix:** Added `@types/node` devDependency and `/// <reference types="node" />` directive in benchmarks.ts
- **Files modified:** packages/conformance/package.json, packages/conformance/src/benchmarks.ts
- **Verification:** `pnpm --filter @riff3d/conformance typecheck` passes
- **Committed in:** ff30e82 (Task 3 commit)

**4. [Rule 1 - Bug] Fixed lint errors in adversarial fixture**
- **Found during:** Task 3 (full monorepo verification)
- **Issue:** Unused variable assignments (shared1/shared2/shared3), standalone expression (level2b), and unused import (EventWire in replay.ts)
- **Fix:** Removed variable assignments, replaced standalone expression with comment, removed unused import
- **Files modified:** packages/fixtures/src/builders/adversarial.ts, packages/conformance/src/replay.ts
- **Verification:** `pnpm --filter @riff3d/fixtures lint` and `pnpm --filter @riff3d/conformance lint` pass
- **Committed in:** ff30e82 (Task 3 commit)

---

**Total deviations:** 4 auto-fixed (1 bug, 3 blocking)
**Impact on plan:** All fixes necessary for API compatibility, TypeScript strict mode, and lint compliance. No scope creep.

## Issues Encountered
None beyond the auto-fixed deviations.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Full fixture suite exportable: `import { buildTransformsParentingFixture, SceneBuilder } from '@riff3d/fixtures'`
- Conformance harness exportable: `import { testRoundTrip, testReplayDeterminism, benchmarkCompilation } from '@riff3d/conformance'`
- All Phase 1 success criteria for TEST-01, TEST-02, TEST-03, TEST-05 met
- Ready for Plan 01-07 (Phase 1 Integration & Validation) which will verify all Phase 1 contracts work together
- 337 total tests across 5 packages, all green
- No blockers for subsequent plans

## Self-Check: PASSED

- All 24 created/modified files verified present on disk
- Commit f711c97 (Task 1) verified in git log
- Commit 129b0cc (Task 2) verified in git log
- Commit ff30e82 (Task 3) verified in git log

---
*Phase: 01-contracts-testing-spine*
*Completed: 2026-02-19*

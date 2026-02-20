---
phase: 04-dual-adapter-validation
plan: 01
subsystem: adapter
tags: [babylonjs, adapter, canonical-ir, pbr, engine-agnostic, EngineAdapter, IRDelta]

# Dependency graph
requires:
  - phase: 01-contracts-testing-spine
    provides: "Canonical IR types (CanonicalScene, CanonicalNode, CanonicalComponent, CanonicalEnvironment)"
  - phase: 02-closed-loop-editor
    provides: "PlayCanvas adapter implementation pattern to mirror"
  - phase: 03-review-gate-foundation
    provides: "PlayCanvas adapter unit tests and globalThis mock pattern"
provides:
  - "Shared EngineAdapter interface in @riff3d/canonical-ir"
  - "Shared IRDelta discriminated union type in @riff3d/canonical-ir"
  - "SerializedCameraState type for engine switching"
  - "@riff3d/adapter-babylon package with full scene rendering from Canonical IR"
  - "Babylon.js mock infrastructure for adapter tests"
affects: [04-02 (incremental delta), 04-03 (conformance), 04-04 (engine switching), 04-05 (visual regression)]

# Tech tracking
tech-stack:
  added: ["@babylonjs/core ~8.52"]
  patterns:
    - "Shared EngineAdapter interface in canonical-ir (not adapter-specific)"
    - "PBRMetallicRoughnessMaterial for Babylon PBR (roughness direct, no inversion)"
    - "rotationQuaternion always (never Euler rotation) in Babylon adapter"
    - "Explicit vi.mock() calls per Babylon sub-module (not dynamic loop)"

key-files:
  created:
    - "packages/canonical-ir/src/types/engine-adapter.ts"
    - "packages/canonical-ir/src/types/ir-delta.ts"
    - "packages/adapter-babylon/src/adapter.ts"
    - "packages/adapter-babylon/src/scene-builder.ts"
    - "packages/adapter-babylon/src/environment.ts"
    - "packages/adapter-babylon/src/component-mappers/index.ts"
    - "packages/adapter-babylon/src/component-mappers/mesh-renderer.ts"
    - "packages/adapter-babylon/src/component-mappers/material.ts"
    - "packages/adapter-babylon/src/component-mappers/light.ts"
    - "packages/adapter-babylon/src/component-mappers/camera.ts"
    - "packages/adapter-babylon/__tests__/helpers/babylon-mocks.ts"
    - "packages/adapter-babylon/__tests__/scene-builder.test.ts"
    - "packages/adapter-babylon/__tests__/component-mappers.test.ts"
    - "packages/adapter-babylon/__tests__/environment.test.ts"
  modified:
    - "packages/canonical-ir/src/types/index.ts"
    - "packages/canonical-ir/tsconfig.json"
    - "packages/adapter-playcanvas/src/types.ts"
    - "packages/adapter-playcanvas/src/adapter.ts"

key-decisions:
  - "DOM lib added to canonical-ir tsconfig for HTMLCanvasElement reference in EngineAdapter interface"
  - "twoSidedLighting removed from Babylon material mapper -- private API in Babylon 8.52, backFaceCulling=false is sufficient"
  - "Explicit vi.mock() calls per Babylon sub-module instead of dynamic loop (vitest hoisting limitation)"
  - "applyDelta stubs on both adapters fall back to full rebuild (04-02 will implement)"

patterns-established:
  - "Babylon mock pattern: explicit per-module vi.mock() with MockTransformNode/MockMesh/MockScene classes"
  - "Engine switching: SerializedCameraState captures position/rotation/mode for transfer between adapters"
  - "Adapter package structure mirrors PlayCanvas: adapter.ts, scene-builder.ts, environment.ts, component-mappers/*"

requirements-completed: [ADPT-02]

# Metrics
duration: 10min
completed: 2026-02-20
---

# Phase 04 Plan 01: Babylon Adapter & Shared Interface Summary

**Babylon.js adapter with 7 primitives, PBR materials, 3 light types, cameras, and environment rendering from shared EngineAdapter interface in canonical-ir**

## Performance

- **Duration:** 10 min
- **Started:** 2026-02-20T18:58:22Z
- **Completed:** 2026-02-20T19:08:59Z
- **Tasks:** 2
- **Files modified:** 24

## Accomplishments
- Extracted EngineAdapter interface and IRDelta type to @riff3d/canonical-ir as shared contract for both adapters
- Created @riff3d/adapter-babylon with full scene rendering from Canonical IR (845 LoC core, well under 1500 budget)
- 45 unit tests covering scene-builder, all 7 primitive types, PBR materials, 3 light types, cameras, and environment settings
- Full monorepo typecheck and test pass with zero regressions (134 PlayCanvas + 45 Babylon + all other packages)

## Task Commits

Each task was committed atomically:

1. **Task 1: Extract EngineAdapter interface and IRDelta type to canonical-ir** - `63e3031` (feat)
2. **Task 2: Create @riff3d/adapter-babylon package with full scene rendering** - `20927c1` (feat)

## Files Created/Modified

### Created
- `packages/canonical-ir/src/types/engine-adapter.ts` - Shared EngineAdapter interface with applyDelta, serializeCameraState, restoreCameraState
- `packages/canonical-ir/src/types/ir-delta.ts` - IRDelta discriminated union (node-transform, node-visibility, component-property, environment, full-rebuild)
- `packages/adapter-babylon/package.json` - Package scaffold with @babylonjs/core ~8.52 dependency
- `packages/adapter-babylon/tsconfig.json` - TypeScript config extending root with DOM lib
- `packages/adapter-babylon/vitest.config.ts` - Test configuration
- `packages/adapter-babylon/src/adapter.ts` - BabylonAdapter implementing EngineAdapter (244 LoC)
- `packages/adapter-babylon/src/scene-builder.ts` - buildScene/destroySceneEntities (129 LoC)
- `packages/adapter-babylon/src/environment.ts` - applyEnvironment/getSkyboxColor (73 LoC)
- `packages/adapter-babylon/src/component-mappers/index.ts` - applyComponents dispatcher (87 LoC)
- `packages/adapter-babylon/src/component-mappers/mesh-renderer.ts` - 7 primitive types via Babylon builders (70 LoC)
- `packages/adapter-babylon/src/component-mappers/material.ts` - PBRMetallicRoughnessMaterial mapper (86 LoC)
- `packages/adapter-babylon/src/component-mappers/light.ts` - Directional/Point/Spot lights (103 LoC)
- `packages/adapter-babylon/src/component-mappers/camera.ts` - UniversalCamera with perspective/orthographic (53 LoC)
- `packages/adapter-babylon/__tests__/helpers/babylon-mocks.ts` - Babylon.js mock classes
- `packages/adapter-babylon/__tests__/scene-builder.test.ts` - 9 tests
- `packages/adapter-babylon/__tests__/component-mappers.test.ts` - 27 tests
- `packages/adapter-babylon/__tests__/environment.test.ts` - 9 tests

### Modified
- `packages/canonical-ir/src/types/index.ts` - Added EngineAdapter, SerializedCameraState, IRDelta exports
- `packages/canonical-ir/tsconfig.json` - Added DOM lib for HTMLCanvasElement
- `packages/adapter-playcanvas/src/types.ts` - Re-exports from canonical-ir for backward compatibility
- `packages/adapter-playcanvas/src/adapter.ts` - Added applyDelta/serializeCameraState/restoreCameraState stubs

## Decisions Made
- **DOM lib on canonical-ir:** The EngineAdapter interface references HTMLCanvasElement, requiring DOM lib. This is appropriate since adapters are inherently DOM-bound.
- **twoSidedLighting dropped:** Babylon's PBRMetallicRoughnessMaterial has this as private API (`_twoSidedLighting`). `backFaceCulling = false` is sufficient for double-sided rendering.
- **Explicit vi.mock() pattern:** Vitest hoists vi.mock() calls, so dynamic loop-based mocking fails. Each Babylon sub-module needs an explicit vi.mock() call.
- **applyDelta stubs:** Both adapters stub applyDelta to fall back to full rebuild. Plan 04-02 will implement incremental deltas.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added DOM lib to canonical-ir tsconfig**
- **Found during:** Task 1 (EngineAdapter extraction)
- **Issue:** canonical-ir did not include DOM types, causing TS2304 for HTMLCanvasElement
- **Fix:** Added `"lib": ["ES2022", "DOM"]` to canonical-ir tsconfig.json
- **Files modified:** packages/canonical-ir/tsconfig.json
- **Verification:** `pnpm turbo run typecheck --filter=@riff3d/canonical-ir` passes
- **Committed in:** 63e3031

**2. [Rule 3 - Blocking] Added missing methods to PlayCanvasAdapter**
- **Found during:** Task 1 (EngineAdapter interface expansion)
- **Issue:** New EngineAdapter methods (applyDelta, serializeCameraState, restoreCameraState) not implemented in PlayCanvasAdapter
- **Fix:** Added stub implementations for all three methods
- **Files modified:** packages/adapter-playcanvas/src/adapter.ts
- **Verification:** `pnpm turbo run typecheck --filter=@riff3d/adapter-playcanvas` passes, all 134 tests pass
- **Committed in:** 63e3031

**3. [Rule 1 - Bug] Fixed twoSidedLighting API mismatch in Babylon material**
- **Found during:** Task 2 (Material mapper implementation)
- **Issue:** `twoSidedLighting` is a private property (`_twoSidedLighting`) on PBRMetallicRoughnessMaterial in Babylon 8.52
- **Fix:** Removed twoSidedLighting assignment; `backFaceCulling = false` is sufficient
- **Files modified:** packages/adapter-babylon/src/component-mappers/material.ts
- **Verification:** Typecheck passes, doubleSided material test passes
- **Committed in:** 20927c1

**4. [Rule 3 - Blocking] Fixed vi.mock() hoisting issue with dynamic loop**
- **Found during:** Task 2 (Test infrastructure)
- **Issue:** Vitest hoists vi.mock() calls but dynamic variables (loop iterator) are not in hoisted scope
- **Fix:** Replaced dynamic loop with explicit per-module vi.mock() calls in all test files
- **Files modified:** All 3 test files
- **Verification:** All 45 tests pass
- **Committed in:** 20927c1

---

**Total deviations:** 4 auto-fixed (1 bug fix, 3 blocking fixes)
**Impact on plan:** All auto-fixes were necessary for correctness and to unblock execution. No scope creep.

## Issues Encountered
None beyond the auto-fixed deviations above.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- EngineAdapter interface and IRDelta type are shared in canonical-ir, ready for 04-02 (incremental delta implementation)
- Babylon adapter has full scene rendering, ready for 04-03 (conformance testing)
- Both adapters implement the same interface, ready for 04-04 (engine switching)
- SerializedCameraState enables camera transfer between adapters

## Self-Check: PASSED

All key files verified present. Both task commits (63e3031, 20927c1) verified in git log.

---
*Phase: 04-dual-adapter-validation*
*Completed: 2026-02-20*

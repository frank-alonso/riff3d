---
phase: 04-dual-adapter-validation
plan: 02
subsystem: adapter
tags: [delta, incremental-update, patchops, canonical-ir, playcanvas, babylonjs, scene-slice, zustand]

# Dependency graph
requires:
  - phase: 04-01
    provides: "Babylon adapter, shared EngineAdapter interface, IRDelta types"
  - phase: 02-02
    provides: "Scene-slice with dispatchOp, compile, loadProject"
provides:
  - "computeDelta() mapping PatchOps to IRDelta for O(1) property updates"
  - "PlayCanvas applyPlayCanvasDelta() handling transform/visibility/component/environment"
  - "Babylon applyBabylonDelta() with roughness direct pass-through and FOV deg-to-rad"
  - "scene-slice lastDelta field for viewport subscriber to route deltas vs full rebuilds"
affects: [04-03-viewport-engine-switching, 04-04-conformance, 05-collaboration]

# Tech tracking
tech-stack:
  added: []
  patterns: ["ComponentType:propertyPath encoding in IRDelta property field", "delta-aware dispatchOp with full rebuild fallback"]

key-files:
  created:
    - "packages/canonical-ir/src/delta.ts"
    - "packages/adapter-playcanvas/src/delta.ts"
    - "packages/adapter-babylon/src/delta.ts"
    - "packages/canonical-ir/__tests__/delta.test.ts"
    - "packages/adapter-playcanvas/__tests__/delta.test.ts"
    - "packages/adapter-babylon/__tests__/delta.test.ts"
  modified:
    - "packages/canonical-ir/src/index.ts"
    - "packages/adapter-playcanvas/src/adapter.ts"
    - "packages/adapter-playcanvas/src/index.ts"
    - "packages/adapter-babylon/src/adapter.ts"
    - "packages/adapter-babylon/src/index.ts"
    - "apps/editor/src/stores/slices/scene-slice.ts"

key-decisions:
  - "ComponentType:propertyPath encoding in IRDelta property string to avoid adding patchops dependency to canonical-ir"
  - "computeDelta accepts simplified PatchOpLike shape to avoid cross-package dependency"
  - "Viewport subscriber wiring deferred to 04-03 (which rewrites viewport-canvas.tsx for engine switching)"

patterns-established:
  - "Delta encoding: computeDelta(op) maps PatchOp types to minimal IRDelta variants"
  - "Adapter delta handler pattern: switch on delta.type, look up entity by nodeId, apply engine-specific API"
  - "Full-rebuild fallback: structural ops and undo/redo always produce lastDelta=null or full-rebuild"

requirements-completed: [ADPT-03]

# Metrics
duration: 6min
completed: 2026-02-20
---

# Phase 4 Plan 2: Incremental Delta Updates Summary

**computeDelta() PatchOp-to-IRDelta mapper with engine-specific delta handlers for O(1) property edits in both PlayCanvas and Babylon.js adapters**

## Performance

- **Duration:** 6 min
- **Started:** 2026-02-20T19:12:48Z
- **Completed:** 2026-02-20T19:19:12Z
- **Tasks:** 2
- **Files modified:** 12

## Accomplishments
- computeDelta() maps all 15 PatchOp types to IRDelta variants (transform/visibility/component-property/environment or full-rebuild)
- PlayCanvas delta handler with roughness-to-gloss inversion, environment fog/ambient/skybox support
- Babylon delta handler with direct roughness pass-through, FOV degrees-to-radians conversion, rotationQuaternion enforcement
- Scene-slice wired with lastDelta field alongside canonicalScene for viewport routing (04-03 wires subscriber)
- 55 new delta tests (24 computeDelta + 14 PlayCanvas + 17 Babylon) with zero test regressions (620 total)

## Task Commits

Each task was committed atomically:

1. **Task 1: computeDelta mapper and adapter delta implementations** - `9416559` (feat)
2. **Task 2: Scene-slice integration and delta tests** - `4ea628f` (feat)

## Files Created/Modified
- `packages/canonical-ir/src/delta.ts` - PatchOp to IRDelta mapper (computeDelta function)
- `packages/canonical-ir/src/index.ts` - Export computeDelta
- `packages/adapter-playcanvas/src/delta.ts` - PlayCanvas delta application (transform, visibility, material, light, camera, environment)
- `packages/adapter-playcanvas/src/adapter.ts` - Wire applyDelta with incremental/full-rebuild routing
- `packages/adapter-playcanvas/src/index.ts` - Export applyPlayCanvasDelta
- `packages/adapter-babylon/src/delta.ts` - Babylon delta application (direct roughness, FOV deg-to-rad, quaternion rotation)
- `packages/adapter-babylon/src/adapter.ts` - Wire applyDelta with incremental/full-rebuild routing
- `packages/adapter-babylon/src/index.ts` - Export applyBabylonDelta
- `apps/editor/src/stores/slices/scene-slice.ts` - Add lastDelta field and computeDelta in dispatchOp
- `packages/canonical-ir/__tests__/delta.test.ts` - 24 tests for computeDelta mapping
- `packages/adapter-playcanvas/__tests__/delta.test.ts` - 14 tests for PlayCanvas delta application
- `packages/adapter-babylon/__tests__/delta.test.ts` - 17 tests for Babylon delta application

## Decisions Made
- **ComponentType:propertyPath encoding:** The IRDelta `property` field encodes the component type and property path as `"Material:baseColor"` format. This avoids adding @riff3d/patchops as a dependency to canonical-ir (which would violate the package dependency direction).
- **PatchOpLike interface:** computeDelta accepts `{ type: string, payload: Record<string, unknown> }` instead of importing PatchOp type. This keeps canonical-ir independent of patchops (it only needs to know op type names, not validate payloads).
- **Viewport subscriber deferred to 04-03:** The actual wiring of lastDelta to adapter.applyDelta() happens in 04-03, which rewrites viewport-canvas.tsx for engine switching. This plan only adds the delta infrastructure and stores lastDelta in scene-slice state.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Delta infrastructure complete: computeDelta, both adapter handlers, scene-slice integration
- 04-03 (Viewport Engine Switching) can wire the delta subscriber to route between applyDelta() and rebuildScene()
- 04-04 (Conformance Tests) can test delta application with golden fixtures
- All 620 monorepo tests pass, zero regressions

---
*Phase: 04-dual-adapter-validation*
*Completed: 2026-02-20*

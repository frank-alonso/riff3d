---
phase: 03-review-gate-foundation
plan: 05
subsystem: editor, testing
tags: [drag-preview, raycasting, performance-budgets, playcanvas, conformance, webxr]

# Dependency graph
requires:
  - phase: 03-03
    provides: "Adapter split into core/editor-tools subpath exports"
  - phase: 01-06
    provides: "Conformance harness with PERFORMANCE_BUDGETS and benchmark infrastructure"
  - phase: 02-06
    provides: "Asset drag-and-drop pipeline with ASSET_DRAG_MIME"
provides:
  - "DragPreviewManager with translucent ghost entity and Y=0 ground plane raycasting"
  - "Tiered performance budgets (Excellent/Pass/Fail) for all key metrics"
  - "checkBudget() helper for runtime budget evaluation"
  - "TIERED_PERFORMANCE_BUDGETS bridging legacy budget consumers"
affects: [03-06, 03-07, phase-7, phase-10]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Mathematical ground plane raycasting (Y=0) without physics dependency"
    - "Tiered performance budgets with CI-measurable vs local-only categories"
    - "Editor-layer MIME parsing preserving adapter dependency boundary"

key-files:
  created:
    - "packages/adapter-playcanvas/src/editor-tools/drag-preview.ts"
    - "packages/adapter-playcanvas/__tests__/drag-preview.test.ts"
    - "packages/conformance/src/budgets.ts"
  modified:
    - "packages/adapter-playcanvas/src/editor-tools/index.ts"
    - "apps/editor/src/components/editor/viewport/viewport-canvas.tsx"
    - "packages/conformance/src/index.ts"
    - "packages/conformance/__tests__/benchmarks.test.ts"

key-decisions:
  - "Editor-layer MIME parsing: DragPreviewManager does NOT import ASSET_DRAG_MIME -- the viewport component parses the DragEvent and passes clean asset IDs into the adapter, preserving the dependency boundary (editor depends on adapter, not vice versa)"
  - "SetProperty PatchOp for drop position: since createOps() has no position parameter, a SetProperty op is appended to the BatchOp to set transform.position at the drop location"
  - "Decompilation budgets added to tiered structure: the review noted the plan omitted decompilation criteria -- added decompilation budgets (same thresholds as compilation) to prevent regression"

patterns-established:
  - "DragPreviewManager pattern: adapter creates ghost entity, editor handles MIME/PatchOps"
  - "Tiered budgets: Excellent (WebXR-ready), Pass (current phase), Fail (regression)"
  - "it.skip() shells for local-only budgets: visible in test report but don't fail CI"

requirements-completed: []

# Metrics
duration: 7min
completed: 2026-02-20
---

# Phase 3 Plan 5: Drag Preview Ghost + Tiered Performance Budgets Summary

**DragPreviewManager with translucent ghost entity, Y=0 ground plane raycasting, and tiered performance budgets (Excellent/Pass/Fail) covering FPS, compilation, PatchOps, and memory**

## Performance

- **Duration:** 7 min
- **Started:** 2026-02-20T16:19:18Z
- **Completed:** 2026-02-20T16:26:29Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments
- DragPreviewManager creates a translucent ghost entity (opacity 0.5, blue emissive tint) during drag-and-drop asset placement
- Mathematical Y=0 ground plane raycasting converts screen coordinates to world-space position without physics dependency
- Tiered performance budgets define formal Excellent/Pass/Fail thresholds for all key metrics, with Excellent tier targeting WebXR readiness (72+ FPS)
- checkBudget() helper enables runtime budget evaluation for Playwright tests in 03-06
- Dependency boundary preserved: adapter handles 3D ghost, editor handles MIME parsing and PatchOps

## Task Commits

Each task was committed atomically:

1. **Task 1: DragPreviewManager with ghost entity and ground plane raycasting** - `0fa8265` (feat) -- Note: committed in prior session as part of 03-06 execution; work verified and reused
2. **Task 2: Tiered performance budgets and conformance benchmarks** - `f3d743e` (feat)

**Plan metadata:** (pending)

## Files Created/Modified
- `packages/adapter-playcanvas/src/editor-tools/drag-preview.ts` - DragPreviewManager class with ghost entity lifecycle and Y=0 ground plane raycasting
- `packages/adapter-playcanvas/__tests__/drag-preview.test.ts` - 15 unit tests for ghost lifecycle, raycasting math, and cleanup
- `packages/adapter-playcanvas/src/editor-tools/index.ts` - Added DragPreviewManager export
- `apps/editor/src/components/editor/viewport/viewport-canvas.tsx` - Wired DragPreviewManager with DOM drag events and PatchOps drop handler
- `packages/conformance/src/budgets.ts` - Tiered (7) and simple (4) performance budget definitions with checkBudget() helper
- `packages/conformance/src/index.ts` - Added budget exports
- `packages/conformance/__tests__/benchmarks.test.ts` - Updated to use tiered budgets, added budget validation tests, local-only skipped shells

## Decisions Made

1. **Editor-layer MIME parsing preserves dependency boundary** -- The Codex review (S1) flagged that importing `ASSET_DRAG_MIME` into the adapter would invert package dependencies. DragPreviewManager accepts clean asset IDs via its public API; the viewport component parses `e.dataTransfer.getData(ASSET_DRAG_MIME)` and passes the result through.

2. **SetProperty PatchOp for drop position** -- Since `createOps(parentId)` generates entities at the origin (no position parameter), a `SetProperty` PatchOp for `transform.position` is appended to the BatchOp to place the entity at the drop location. This avoids modifying the starter asset contract.

3. **Decompilation budgets added** -- The Codex review (S2) noted the plan omitted decompilation criteria. Added decompilation budgets (same thresholds as compilation) to `TIERED_PERFORMANCE_BUDGETS` to prevent regression of existing conformance coverage.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Added decompilation budgets to tiered structure**
- **Found during:** Task 2 (performance budgets)
- **Issue:** Plan's tiered budget table omitted decompilation criteria; existing benchmarks already test decompilation
- **Fix:** Added `decompilation` entry to `TIERED_PERFORMANCE_BUDGETS` with same thresholds as compilation
- **Files modified:** packages/conformance/src/budgets.ts, packages/conformance/__tests__/benchmarks.test.ts
- **Verification:** Conformance tests pass with decompilation assertions using tiered thresholds
- **Committed in:** f3d743e (Task 2 commit)

**2. [Rule 1 - Bug] Handled browser security restriction on dragenter getData**
- **Found during:** Task 1 (viewport drag wiring)
- **Issue:** Browser security prevents reading `dataTransfer.getData()` during dragenter events; only `types` array is accessible
- **Fix:** Used placeholder asset ID (`__pending__`) during dragenter, re-created preview with real ID on drop
- **Files modified:** apps/editor/src/components/editor/viewport/viewport-canvas.tsx
- **Verification:** Drop handler correctly extracts and passes asset ID
- **Committed in:** 0fa8265 (Task 1 commit)

---

**Total deviations:** 2 auto-fixed (1 missing critical, 1 bug)
**Impact on plan:** Both auto-fixes necessary for correctness. No scope creep.

## Issues Encountered
- Task 1 was already committed from a prior session execution (`0fa8265` as part of 03-06). Verified the work was complete and correct, then proceeded to Task 2 without re-committing.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- DragPreviewManager exported from `@riff3d/adapter-playcanvas/editor-tools` for use in E2E tests
- Performance budgets importable from `@riff3d/conformance` for Playwright measurement in 03-06
- Phase 7 TODO documented in drag-preview.ts for physics-based surface normal snapping
- Adapter core LoC budget remains at 898/1500 (drag-preview is in editor-tools, not core)

## Self-Check: PASSED

All 7 created/modified files verified on disk. Both commit hashes (0fa8265, f3d743e) found in git history.

---
*Phase: 03-review-gate-foundation*
*Completed: 2026-02-20*

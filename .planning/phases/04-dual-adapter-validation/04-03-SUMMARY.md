---
phase: 04-dual-adapter-validation
plan: 03
subsystem: editor
tags: [engine-switching, viewport, zustand, babylon, playcanvas, delta, inspector, tuning, confirm-dialog]

# Dependency graph
requires:
  - phase: 04-01
    provides: "BabylonAdapter, shared EngineAdapter interface, SerializedCameraState"
  - phase: 04-02
    provides: "computeDelta, lastDelta in scene-slice, applyDelta on both adapters"
  - phase: 02-02
    provides: "ViewportCanvas, ViewportProvider, editor-shell with loadProject"
  - phase: 02-06
    provides: "Environment panel in inspector, DragPreviewManager"
provides:
  - "Engine state slice (activeEngine, isSwitchingEngine, switchEngine)"
  - "Engine-agnostic ViewportProvider (EngineAdapter ref instead of PlayCanvasAdapter)"
  - "ViewportCanvas with engine switching, camera preservation, and delta-aware subscriber"
  - "EngineSwitcher component in top bar with confirmation dialog"
  - "EngineTuningSection in inspector with active/peek toggle"
  - "ConfirmDialog reusable UI component"
  - "ECSON metadata preferredEngine persistence"
affects: [04-04-conformance, 04-05-visual-regression, 05-collaboration]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Engine switching via activeEngine store key driving useEffect re-execution"
    - "Switch counter ref pattern for invalidating stale async callbacks"
    - "Delta-aware canonicalScene subscriber routing to applyDelta vs rebuildScene"
    - "Engine preference as system-level ECSON metadata mutation (non-PatchOp)"
    - "Engine icon badges (PC/BJ styled spans) instead of external icon assets"

key-files:
  created:
    - "apps/editor/src/stores/slices/engine-slice.ts"
    - "apps/editor/src/components/editor/shell/engine-switcher.tsx"
    - "apps/editor/src/components/editor/inspector/engine-tuning-section.tsx"
    - "apps/editor/src/components/ui/confirm-dialog.tsx"
  modified:
    - "apps/editor/src/stores/editor-store.ts"
    - "apps/editor/src/components/editor/viewport/viewport-provider.tsx"
    - "apps/editor/src/components/editor/viewport/viewport-canvas.tsx"
    - "apps/editor/src/components/editor/shell/editor-shell.tsx"
    - "apps/editor/src/components/editor/shell/top-bar.tsx"
    - "apps/editor/src/components/editor/inspector/inspector-panel.tsx"
    - "apps/editor/package.json"

key-decisions:
  - "Engine preference persisted as ECSON metadata.preferredEngine (system-level mutation, not PatchOp) matching loadProject/playtest exception pattern"
  - "Switch counter ref pattern prevents stale async init callbacks from interfering with newer engine switches"
  - "Dynamic import for Babylon adapter avoids loading @babylonjs/core when PlayCanvas is active"
  - "PlayCanvas editor tools (gizmos, selection, grid, drag preview) only available when PlayCanvas is active; Babylon editor tools deferred to Phase 5+"
  - "Delta-aware canonicalScene subscriber wired to route lastDelta to applyDelta() vs rebuildScene() (completing 04-02 integration)"

patterns-established:
  - "Engine switching: activeEngine drives useEffect re-execution, cleanup disposes old adapter, setup creates new one"
  - "Camera state serialization: serialize before dispose, restore after initialize"
  - "ConfirmDialog: reusable modal with backdrop blur, ESC cancel, focus trap"
  - "EngineTuningSection: collapsible with peek toggle for read-only view of other engine"

requirements-completed: [PORT-03]

# Metrics
duration: 5min
completed: 2026-02-20
---

# Phase 04 Plan 03: Viewport Engine Switching Summary

**Engine switching UI with confirmation dialog, delta-aware viewport, camera preservation, and inspector tuning section for dual PlayCanvas/Babylon.js rendering**

## Performance

- **Duration:** 5 min
- **Started:** 2026-02-20T19:21:57Z
- **Completed:** 2026-02-20T19:27:12Z
- **Tasks:** 2
- **Files modified:** 12

## Accomplishments
- Engine state slice manages activeEngine/isSwitchingEngine with ECSON metadata persistence
- ViewportCanvas generalized from PlayCanvas-only to engine-agnostic with delta-aware subscriber (completing 04-02 wiring)
- Engine switcher in top bar with confirmation dialog, play-mode disable, and tuning badge
- Engine tuning section in inspector with collapsible display and peek-other-engine read-only toggle
- Reusable ConfirmDialog component for the editor UI toolkit
- Full monorepo typecheck (12/12 packages) and test pass (620+ tests) with zero regressions

## Task Commits

Each task was committed atomically:

1. **Task 1: Engine state slice and viewport generalization** - `03648c4` (feat)
2. **Task 2: Engine switcher UI, tuning inspector, and confirmation dialog** - `1dc208f` (feat)

## Files Created/Modified

### Created
- `apps/editor/src/stores/slices/engine-slice.ts` - Engine state management (activeEngine, switching, preference persistence)
- `apps/editor/src/components/editor/shell/engine-switcher.tsx` - Engine switcher with PC/BJ badges, confirmation dialog, disabled during play mode
- `apps/editor/src/components/editor/inspector/engine-tuning-section.tsx` - Collapsible tuning display with active/peek toggle
- `apps/editor/src/components/ui/confirm-dialog.tsx` - Reusable confirmation modal with backdrop blur and ESC cancel

### Modified
- `apps/editor/src/stores/editor-store.ts` - Added EngineSlice to composed store
- `apps/editor/src/components/editor/viewport/viewport-provider.tsx` - Generalized from PlayCanvasAdapter to EngineAdapter
- `apps/editor/src/components/editor/viewport/viewport-canvas.tsx` - Major rework: engine-agnostic, delta-aware, camera preservation
- `apps/editor/src/components/editor/shell/editor-shell.tsx` - Read preferredEngine from ECSON metadata on project load
- `apps/editor/src/components/editor/shell/top-bar.tsx` - Added EngineSwitcher between project name and play controls
- `apps/editor/src/components/editor/inspector/inspector-panel.tsx` - Added EngineTuningSection for entity and scene-level tuning
- `apps/editor/package.json` - Added @riff3d/adapter-babylon dependency
- `pnpm-lock.yaml` - Updated lockfile for new workspace dependency

## Decisions Made
- **Engine preference as metadata mutation:** Persisted as `ecsonDoc.metadata.preferredEngine` using a direct mutation (not PatchOp), matching the approved exception pattern for system-level state changes like loadProject/playtest stop. This bumps docVersion to trigger auto-save.
- **Switch counter pattern:** A ref-based counter incremented on each engine switch invalidates stale async callbacks from previous switches. This prevents race conditions when rapid switching occurs.
- **Dynamic Babylon import:** `await import("@riff3d/adapter-babylon")` only loads Babylon.js code when the user actually switches to it, keeping the initial bundle size minimal.
- **PlayCanvas-only editor tools:** Gizmos, selection manager, grid, and drag preview only initialize when PlayCanvas is active. When Babylon is active, editing is via inspector/hierarchy panels only. Babylon editor tools are Phase 5+ scope.
- **Delta-aware subscriber:** The viewport canonicalScene subscriber now checks `lastDelta` from the scene-slice (added in 04-02) and routes to `adapter.applyDelta()` for O(1) updates or `adapter.rebuildScene()` for structural changes, completing the end-to-end delta pipeline.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added @riff3d/adapter-babylon dependency to editor**
- **Found during:** Task 1 (Engine state slice)
- **Issue:** Editor package only depended on @riff3d/adapter-playcanvas; dynamic import of @riff3d/adapter-babylon would fail without the workspace dependency
- **Fix:** Added `"@riff3d/adapter-babylon": "workspace:*"` to editor package.json and ran pnpm install
- **Files modified:** apps/editor/package.json, pnpm-lock.yaml
- **Verification:** `pnpm install` succeeds, dynamic import resolves correctly
- **Committed in:** 03648c4

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Necessary for the dynamic Babylon adapter import to resolve. No scope creep.

## Issues Encountered
None beyond the auto-fixed deviation above.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Engine switching infrastructure is complete, ready for 04-04 (Conformance Testing)
- Delta-aware viewport subscriber is wired end-to-end, enabling O(1) property updates in both engines
- EngineTuningSection is ready for conformance UI overlay (04-05 visual regression)
- All 620+ monorepo tests pass, zero regressions

## Self-Check: PASSED

All 4 created files and 6 modified files verified present. Both task commits (03648c4, 1dc208f) verified in git log.

---
*Phase: 04-dual-adapter-validation*
*Completed: 2026-02-20*

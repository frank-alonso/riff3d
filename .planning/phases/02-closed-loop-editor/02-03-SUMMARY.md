---
phase: 02-closed-loop-editor
plan: 03
subsystem: 3d-engine, ui, interaction
tags: [playcanvas, gizmo, selection, grid, transform, patchops, toolbar, keyboard-shortcuts]

# Dependency graph
requires:
  - phase: 02-closed-loop-editor
    plan: 02
    provides: PlayCanvas adapter, scene builder, camera controller, Zustand store slices, ViewportCanvas
provides:
  - GizmoManager: translate/rotate/scale gizmos with transform:start/end PatchOp dispatch
  - SelectionManager: click, shift-click, box-select entity picking with highlight feedback
  - Grid: immediate-mode ground plane with major/minor lines and configurable cell size
  - FloatingToolbar: Figma-style viewport overlay with gizmo mode, snap, grid size, camera controls
  - Keyboard shortcuts: W/E/R gizmo modes, Escape deselect, Delete remove, F focus
affects: [02-04, 02-05, 02-06, 02-07, 02-08]

# Tech tracking
tech-stack:
  added: []
  patterns: ["GizmoManager captures transform on drag start, creates PatchOp only on drag end (one op per gesture)", "SelectionManager uses frustum-based screen-space projection for entity picking (no framebuffer overhead)", "Grid uses immediate-mode drawLine API per frame (not mesh entity, avoids selection picking)", "Selection highlight via emissive color tint on StandardMaterial", "Minimal store interface types on adapter side to avoid coupling adapter package to editor"]

key-files:
  created:
    - packages/adapter-playcanvas/src/gizmo-manager.ts
    - packages/adapter-playcanvas/src/selection-manager.ts
    - packages/adapter-playcanvas/src/grid.ts
    - apps/editor/src/components/editor/viewport/floating-toolbar.tsx
    - apps/editor/src/hooks/use-keyboard-shortcuts.ts
  modified:
    - packages/adapter-playcanvas/src/adapter.ts
    - packages/adapter-playcanvas/src/index.ts
    - apps/editor/src/components/editor/viewport/viewport-canvas.tsx
    - apps/editor/src/components/editor/shell/editor-shell.tsx

key-decisions:
  - "Minimal store interface types on adapter side (GizmoStoreApi, SelectionStoreApi) to avoid coupling adapter package to full editor store type"
  - "Emissive color tint for selection highlight (simpler than outline shader, compatible with all materials)"
  - "Immediate-mode drawLine for grid (not mesh entity) to avoid grid being pickable by selection manager"
  - "CSS-based selection rectangle overlay (not canvas-drawn) to avoid WebGL state conflicts"

patterns-established:
  - "GizmoManager pattern: capture previous transform on transform:start, dispatch PatchOp on transform:end with actual/previous values"
  - "SelectionManager pattern: screen-space projection picking with entity bounding radius, click vs drag detection via time+distance thresholds"
  - "Adapter accessor pattern: getApp(), getCameraEntity(), getTypedEntityMap() for internal subsystem access"

requirements-completed: [EDIT-02, EDIT-07]

# Metrics
duration: 7min
completed: 2026-02-19
---

# Phase 2 Plan 03: Entity Selection and Transform Gizmos Summary

**Transform gizmos (translate/rotate/scale) with snap-to-grid, entity selection (click/shift/box), ground grid, and floating viewport toolbar with keyboard shortcuts**

## Performance

- **Duration:** ~7 min
- **Started:** 2026-02-20T02:54:10Z
- **Completed:** 2026-02-20T03:01:11Z
- **Tasks:** 2 (both auto)
- **Files modified:** 9 (5 created, 4 modified)

## Accomplishments

- GizmoManager wraps PlayCanvas TranslateGizmo/RotateGizmo/ScaleGizmo with store-driven mode switching, snap support, and PatchOp dispatch on transform:end (one op per drag gesture, not per frame)
- SelectionManager with click selection (closest entity via screen-space projection), shift-click multi-select toggle, and box/marquee selection with CSS overlay
- Ground grid at Y=0 using immediate-mode line rendering with configurable grid size, major lines every 10 units
- Figma-style floating toolbar at viewport bottom-center with gizmo mode buttons (Move/Rotate/Scale), snap toggle, grid size popover, and camera mode toggle
- Industry-standard keyboard shortcuts: W/E/R for gizmo modes, Escape to deselect, Delete/Backspace to remove entities (dispatches DeleteEntity PatchOps), F for focus
- ViewportCanvas wires up all subsystems (gizmo manager, selection manager, grid) on adapter initialization with proper cleanup

## Task Commits

Each task was committed atomically:

1. **Task 1: Gizmo manager, selection manager, and grid** - `05334fa` (feat)
2. **Task 2: Floating toolbar and keyboard shortcuts** - `e0b58f6` (feat)

## Files Created/Modified

### Adapter Package (packages/adapter-playcanvas/)
- `src/gizmo-manager.ts` - GizmoManager class: translate/rotate/scale lifecycle, snap, transform:start/end PatchOp dispatch
- `src/selection-manager.ts` - SelectionManager class: click, shift-click, box-select with screen-space projection picking and emissive highlight
- `src/grid.ts` - GridHandle class: immediate-mode drawLine grid at Y=0 with configurable cell size and major/minor line distinction
- `src/adapter.ts` - Added getApp(), getCameraEntity(), getTypedEntityMap() accessors
- `src/index.ts` - Export GizmoManager, SelectionManager, createGrid, GridHandle

### Editor (apps/editor/)
- `src/components/editor/viewport/floating-toolbar.tsx` - FloatingToolbar with gizmo mode, snap, grid size popover, camera mode
- `src/components/editor/viewport/viewport-canvas.tsx` - Wire up GizmoManager, SelectionManager, Grid on adapter init; mount FloatingToolbar
- `src/hooks/use-keyboard-shortcuts.ts` - useKeyboardShortcuts hook: W/E/R, Escape, Delete, F
- `src/components/editor/shell/editor-shell.tsx` - Call useKeyboardShortcuts()

## Decisions Made

1. **Minimal store interface types on adapter side** - The adapter package defines `GizmoStoreApi` and `SelectionStoreApi` interfaces with only the properties they need, rather than importing the full EditorState type from the editor. This avoids a dependency from `@riff3d/adapter-playcanvas` back to `@riff3d/editor` (which would create a circular dependency).

2. **Emissive color tint for selection highlight** - Selected entities get their material's emissive color set to a blue tint. This is simpler than outline shaders and works with all StandardMaterial instances. The original emissive value is stored for restoration on deselect.

3. **Immediate-mode drawLine for grid** - Instead of creating a mesh entity (which would be pickable by the selection manager), the grid uses PlayCanvas's `app.drawLine()` called each frame. This ensures the grid is purely visual and never interferes with entity selection.

4. **CSS-based selection rectangle** - The box-select marquee is an absolutely-positioned `<div>` overlay with dashed border and semi-transparent background, rather than drawing on the WebGL canvas. This avoids potential WebGL state conflicts and is simpler to implement.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] PatchOp Origin type is string enum, not object**
- **Found during:** Task 2 (viewport-canvas.tsx, use-keyboard-shortcuts.ts)
- **Issue:** Plan implied `origin: { type: "user" }` but OriginSchema is `z.enum(["user", "ai", "system", "replay"])` -- a simple string, not an object.
- **Fix:** Changed `origin: { type: "user" }` to `origin: "user"` in PatchOp construction
- **Files modified:** `apps/editor/src/components/editor/viewport/viewport-canvas.tsx`, `apps/editor/src/hooks/use-keyboard-shortcuts.ts`
- **Verification:** `pnpm typecheck --filter @riff3d/editor` passes
- **Committed in:** e0b58f6

**2. [Rule 1 - Bug] PatchOp requires explicit version field**
- **Found during:** Task 2 (typecheck)
- **Issue:** PatchOp TypeScript type requires `version: number` even though Zod schema has `.default()`. TypeScript inferred type from Zod doesn't know about defaults at the type level.
- **Fix:** Added `version: CURRENT_PATCHOP_VERSION` to all PatchOp constructions, imported from `@riff3d/patchops`
- **Files modified:** `apps/editor/src/components/editor/viewport/viewport-canvas.tsx`, `apps/editor/src/hooks/use-keyboard-shortcuts.ts`
- **Verification:** `pnpm typecheck --filter @riff3d/editor` passes
- **Committed in:** e0b58f6

---

**Total deviations:** 2 auto-fixed (2 bugs)
**Impact on plan:** Both fixes were necessary for TypeScript compilation. No scope changes, just correct type usage.

## Issues Encountered

None beyond the auto-fixed type issues.

## User Setup Required

None - no external service configuration required. All changes are client-side.

## Next Phase Readiness

- Gizmo, selection, and grid systems are fully integrated into the viewport lifecycle
- GizmoManager subscribes to store and auto-switches gizmo mode, attaches to selected entities
- SelectionManager auto-updates highlights when selection changes
- Entity map references are updated after scene rebuilds (gizmoManager.updateEntityMap, selectionManager.updateEntityMap)
- PatchOp dispatch pattern established: `generateOpId()` + `CURRENT_PATCHOP_VERSION` + `origin: "user"` for all user-initiated ops
- Ready for 02-04 (Inspector panel reading selection to display entity properties)
- Ready for 02-05 (undo/redo consuming the inverse ops returned by dispatchOp)

## Self-Check: PASSED

All 5 created files verified present on disk. All 2 commit hashes (05334fa, e0b58f6) verified in git log.

---
*Phase: 02-closed-loop-editor, Plan: 03*
*Completed: 2026-02-19*

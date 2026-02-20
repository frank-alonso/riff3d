---
phase: 02-closed-loop-editor
plan: 07
subsystem: ui
tags: [playtest, play-mode, snapshot-restore, state-machine, zustand, playcanvas, keyboard-shortcuts]

# Dependency graph
requires:
  - phase: 02-02
    provides: PlayCanvas adapter with scene rebuild, editor camera, viewport canvas
  - phase: 02-04
    provides: Inspector panel for scene property editing
  - phase: 02-05
    provides: Undo/redo stacks, clipboard, auto-save
provides:
  - Play/pause/stop state machine with ECSON snapshot/restore
  - PlayControls button group in top bar
  - Play mode visual border overlay (cyan playing, amber paused)
  - Panel collapse with peekable behavior during play mode
  - Keyboard shortcuts for play control (Ctrl+P, F5, Space)
  - Adapter setPlayMode/setTimeScale for runtime mode toggling
affects: [02-08, phase-7-physics, phase-8-ejection]

# Tech tracking
tech-stack:
  added: []
  patterns: [play-mode-state-machine, ecson-snapshot-restore, peekable-panel-collapse, visual-mode-indicator]

key-files:
  created:
    - apps/editor/src/stores/slices/playtest-slice.ts
    - apps/editor/src/components/editor/playtest/play-controls.tsx
    - apps/editor/src/components/editor/playtest/play-mode-border.tsx
  modified:
    - apps/editor/src/stores/editor-store.ts
    - packages/adapter-playcanvas/src/adapter.ts
    - apps/editor/src/components/editor/shell/top-bar.tsx
    - apps/editor/src/components/editor/shell/editor-shell.tsx
    - apps/editor/src/hooks/use-keyboard-shortcuts.ts

key-decisions:
  - "Discard-all on Stop -- keep runtime changes deferred to future enhancement"
  - "useState for peek state (not refs) -- React 19 strict ref-during-render rules prevent ref-based approach"
  - "Adapter setPlayMode controls only timeScale -- grid/gizmo/selection toggling handled at viewport level"

patterns-established:
  - "Play mode state machine: play(snapshot) -> pause(freeze) -> resume -> stop(restore+rebuild)"
  - "Peekable panels: collapsed during play, hover/click to temporarily reveal, auto-collapse on mouse leave"
  - "Visual mode indicator: colored border overlay + top bar tint for unambiguous play state feedback"

requirements-completed: [EDIT-10]

# Metrics
duration: 5min
completed: 2026-02-20
---

# Phase 2 Plan 7: Play-Test Mode Summary

**Play/pause/stop state machine with ECSON snapshot/restore, visual play-mode border, panel collapse, and keyboard shortcuts**

## Performance

- **Duration:** 5 min
- **Started:** 2026-02-20T05:03:38Z
- **Completed:** 2026-02-20T05:09:31Z
- **Tasks:** 2
- **Files modified:** 8

## Accomplishments
- Playtest state machine (play/pause/resume/stop) with deep-clone ECSON snapshot on play and full restore on stop
- Play controls button group centered in top bar with state-dependent rendering and visual feedback
- Colored border overlay around viewport during play mode (cyan for playing, amber for paused, with glow animation)
- Panel collapse behavior during play mode with peekable hover/click to temporarily reveal panels
- Keyboard shortcuts: Ctrl+P / F5 toggle play/stop, Space toggle pause/resume during play mode
- Top bar background tint changes to indicate play state (cyan tint playing, amber tint paused)
- Adapter methods for runtime mode control (setPlayMode, setTimeScale, isInPlayMode)

## Task Commits

Each task was committed atomically:

1. **Task 1: Playtest state machine with snapshot/restore** - `a4dd85d` (feat)
2. **Task 2: Play controls UI, visual indicator, and panel collapse** - `9a9c596` (feat)

## Files Created/Modified
- `apps/editor/src/stores/slices/playtest-slice.ts` - Play/pause/stop state machine with ECSON snapshot
- `apps/editor/src/stores/editor-store.ts` - Composed playtest-slice into combined store
- `packages/adapter-playcanvas/src/adapter.ts` - Added setPlayMode, setTimeScale, isInPlayMode methods
- `apps/editor/src/components/editor/playtest/play-controls.tsx` - Play/Pause/Stop button group
- `apps/editor/src/components/editor/playtest/play-mode-border.tsx` - Colored border overlay for play mode
- `apps/editor/src/components/editor/shell/top-bar.tsx` - Replaced placeholder with real PlayControls, added play state tinting
- `apps/editor/src/components/editor/shell/editor-shell.tsx` - Panel collapse with peekable behavior, PlayModeBorder overlay
- `apps/editor/src/hooks/use-keyboard-shortcuts.ts` - Added Ctrl+P/F5 play/stop and Space pause/resume shortcuts

## Decisions Made
- **Discard-all on Stop:** Per plan and research, "keep runtime changes" is deferred. Stop always restores pre-play ECSON snapshot. No UI prompt needed.
- **useState for peek state:** React 19 strict lint rules (`react-hooks/refs`, `react-hooks/set-state-in-effect`) prevent ref-based peek state or setState in useEffect. Used plain useState with derived visibility gating on isPlaying.
- **Adapter controls only timeScale:** setPlayMode on adapter controls engine timeScale only. Grid/gizmo/selection toggling is handled at the viewport component level via their respective managers, keeping the adapter interface minimal.
- **Panel state saved in playtest slice:** prePanelState captures activePanel and inspectorVisible on play, restores on stop, ensuring panels return to their pre-play configuration.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] React 19 lint compliance for peek state management**
- **Found during:** Task 2 (panel collapse behavior)
- **Issue:** Initial implementation used useRef + render-time reads (violates `react-hooks/refs`) and useEffect setState (violates `react-hooks/set-state-in-effect`)
- **Fix:** Switched to plain useState for peek state with derived visibility gating. Peek state is only relevant when isPlaying is true, so stale values from previous sessions are harmless.
- **Files modified:** `apps/editor/src/components/editor/shell/editor-shell.tsx`
- **Verification:** `pnpm lint` passes with zero errors
- **Committed in:** 9a9c596 (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 bug fix for React 19 lint compliance)
**Impact on plan:** Minor implementation adjustment. No scope creep.

## Issues Encountered
None beyond the React 19 lint deviation above.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Play-test mode completes the closed-loop editor pipeline: create -> render -> play -> stop -> continue editing
- Ready for 02-08 (final phase 2 plan)
- Adapter setPlayMode/setTimeScale methods are ready for Phase 7 physics integration (timeScale controls simulation stepping)

## Self-Check: PASSED

- All 3 created files verified on disk
- Both task commits (a4dd85d, 9a9c596) verified in git log

---
*Phase: 02-closed-loop-editor*
*Completed: 2026-02-20*

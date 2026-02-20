---
phase: 02-closed-loop-editor
plan: 05
subsystem: editor, testing
tags: [undo-redo, clipboard, auto-save, patchops, property-testing, zustand, supabase]

# Dependency graph
requires:
  - phase: 02-02
    provides: "PlayCanvas viewport adapter, ECSON compile pipeline, dispatchOp"
  - phase: 02-03
    provides: "Keyboard shortcuts hook, gizmo mode, selection"
provides:
  - "Undo/redo via invertible PatchOp stacks (undoStack/redoStack)"
  - "Copy/paste/duplicate entities with BatchOp dispatch"
  - "Auto-save to Supabase with 5s debounce and immediate structural save"
  - "Manual save via Ctrl+S"
  - "Save status indicator in TopBar (Saved/Saving/Unsaved/Error)"
  - "Thumbnail capture on save to Supabase Storage"
  - "CF-01: Nightly property tests (1000 runs, rotating seed)"
  - "CF-02: Lossiness contract tests enumerating stripped vs preserved fields"
  - "CF-03: Mutation bypass enforcement test via deep-freeze"
affects: [02-06, 02-07, 02-08]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Undo/redo via inverse PatchOp stacks with MAX_UNDO_DEPTH=200"
    - "Custom event dispatch (riff3d:manual-save) for cross-hook communication"
    - "Save slice pattern for save status state management"
    - "describe.skipIf(!process.env.NIGHTLY) for conditional test suite execution"

key-files:
  created:
    - "apps/editor/src/lib/clipboard.ts"
    - "apps/editor/src/hooks/use-auto-save.ts"
    - "apps/editor/src/stores/slices/save-slice.ts"
    - "packages/patchops/__tests__/nightly-property.test.ts"
    - "packages/conformance/__tests__/lossiness-contract.test.ts"
    - "packages/patchops/__tests__/mutation-bypass.test.ts"
  modified:
    - "apps/editor/src/stores/slices/scene-slice.ts"
    - "apps/editor/src/stores/editor-store.ts"
    - "apps/editor/src/stores/hooks.ts"
    - "apps/editor/src/hooks/use-keyboard-shortcuts.ts"
    - "apps/editor/src/components/editor/shell/top-bar.tsx"
    - "apps/editor/src/components/editor/shell/editor-shell.tsx"

key-decisions:
  - "MAX_UNDO_DEPTH=200 to cap memory growth on long editing sessions"
  - "Custom event (riff3d:manual-save) for Ctrl+S to decouple keyboard shortcuts from auto-save hook"
  - "Tuning field IS preserved through IR round-trip (compiler/decompiler carry it), unlike plan assumption"
  - "Internal clipboard buffer as fallback when navigator.clipboard API fails"
  - "BatchOp for paste/duplicate operations so undo reverts entire operation atomically"

patterns-established:
  - "Undo/redo: dispatch -> push inverse to undoStack -> clear redoStack -> recompile IR"
  - "Structural ops trigger immediate save; property ops debounce 5 seconds"
  - "Nightly tests guarded by NIGHTLY env var, logged seeds for failure reproduction"

requirements-completed: [EDIT-05, EDIT-06, EDIT-08]

# Metrics
duration: 7min
completed: 2026-02-19
---

# Phase 2 Plan 5: Undo/Redo, Clipboard, Auto-Save Summary

**Invertible PatchOp undo/redo stacks, clipboard copy/paste/duplicate with BatchOp dispatch, Supabase auto-save with 5s debounce, and carry-forward test items CF-01/02/03**

## Performance

- **Duration:** 7 min
- **Started:** 2026-02-20T04:15:24Z
- **Completed:** 2026-02-20T04:23:09Z
- **Tasks:** 2
- **Files modified:** 12

## Accomplishments
- Undo/redo via invertible PatchOp stacks with full edit type support (transform, property, reparent, create/delete, component)
- Copy/paste/duplicate entities with new IDs, component cloning, and BatchOp atomic dispatch
- Auto-save to Supabase with 5-second debounce, immediate save on structural changes, and visibility change trigger
- Save status indicator in TopBar with four states (Saved/Saving/Unsaved/Error)
- CF-01 nightly property tests: 1000 iterations with rotating seed and seed logging for failure reproduction
- CF-02 lossiness contract tests: 29 tests enumerating stripped fields (tags, locked) and asserting all other fields preserved through round-trip
- CF-03 mutation bypass test: deep-freeze validates direct mutation throws TypeError while PatchOps remain the sanctioned mutation path

## Task Commits

Each task was committed atomically:

1. **Task 1: Undo/redo stacks and copy/paste/duplicate** - `8030868` (feat)
2. **Task 2: Auto-save, manual save, save status indicator, and carry-forward tests** - `1e3ba13` (feat)

## Files Created/Modified
- `apps/editor/src/stores/slices/scene-slice.ts` - Undo/redo stacks, docVersion, lastOpType, undo()/redo() methods
- `apps/editor/src/lib/clipboard.ts` - copyEntities, pasteEntities, duplicateEntities, readClipboard
- `apps/editor/src/hooks/use-keyboard-shortcuts.ts` - Added Ctrl+Z, Ctrl+Shift+Z/Y, Ctrl+C/V/D/A/S shortcuts
- `apps/editor/src/stores/slices/save-slice.ts` - SaveStatus type, saveStatus/lastSavedAt state
- `apps/editor/src/stores/editor-store.ts` - Added SaveSlice to store composition
- `apps/editor/src/stores/hooks.ts` - Added selectors for canUndo, canRedo, docVersion, saveStatus, etc.
- `apps/editor/src/hooks/use-auto-save.ts` - Auto-save hook with debounce, structural change detection, thumbnail capture
- `apps/editor/src/components/editor/shell/top-bar.tsx` - Dynamic SaveIndicator component replacing static "Saved" text
- `apps/editor/src/components/editor/shell/editor-shell.tsx` - Wired useAutoSave hook
- `packages/patchops/__tests__/nightly-property.test.ts` - 4 property tests at 1000 iterations with rotating seed (CF-01)
- `packages/conformance/__tests__/lossiness-contract.test.ts` - 29 lossiness contract tests (CF-02)
- `packages/patchops/__tests__/mutation-bypass.test.ts` - 7 mutation bypass enforcement tests (CF-03)

## Decisions Made
- **MAX_UNDO_DEPTH=200**: Caps memory growth on long editing sessions. 200 operations is generous for typical workflows.
- **Custom event for manual save**: `riff3d:manual-save` custom DOM event decouples keyboard shortcut hook from auto-save hook without adding more store state.
- **Tuning preserved through IR**: The plan listed tuning as stripped, but the compiler/decompiler actually carry it. Updated lossiness contract test accordingly. Only `tags` and `locked` are truly stripped.
- **Internal clipboard buffer**: Navigator Clipboard API fails in non-secure contexts or without focus. Internal buffer ensures copy/paste always works within the editor.
- **BatchOp for paste/duplicate**: Wrapping all CreateEntity + AddComponent ops in a BatchOp means a single undo reverts the entire paste/duplicate operation atomically.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Corrected lossiness contract: tuning is NOT stripped**
- **Found during:** Task 2 (CF-02 lossiness contract tests)
- **Issue:** Plan assumed entity `tuning` was stripped during round-trip, but the compiler/decompiler actually preserves it through IR.
- **Fix:** Removed `tuning` from EXPECTED_STRIPPED_ENTITY_FIELDS. Only `tags` and `locked` are truly stripped.
- **Files modified:** `packages/conformance/__tests__/lossiness-contract.test.ts`
- **Verification:** All 29 lossiness contract tests pass across all 7 fixtures.
- **Committed in:** 1e3ba13 (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Minor correction. The lossiness contract is now accurate to the actual IR behavior.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Undo/redo foundation ready for all future edit operations
- Auto-save pipeline ready for collaboration integration (02-06)
- Carry-forward items CF-01, CF-02, CF-03 all resolved
- 02-06 (asset browser/drag-drop) and 02-07 (playtest) can proceed

## Self-Check: PASSED

All 13 files verified present. Both task commits (8030868, 1e3ba13) verified in git log.

---
*Phase: 02-closed-loop-editor*
*Completed: 2026-02-19*

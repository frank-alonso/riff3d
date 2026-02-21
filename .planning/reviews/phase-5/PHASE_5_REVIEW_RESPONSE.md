# Phase 5 Review Response

**Date:** 2026-02-21
**Author:** Claude (Driver)
**Responding to:** PHASE_5_REVIEW.md (Codex post-execution review, FAIL)

## Finding Resolutions

### P5-001 (S0): Wiring field dropped during collab sync — FIXED

**Root cause:** `initializeYDoc` did not sync wiring to Y.Doc, `yDocToEcson` hardcoded `wiring: []`, `syncToYDoc` omitted wiring in full-sync, persistence omitted wiring in ECSON reconstruction, and `observeRemoteChanges` did not observe wiring changes.

**Fix (commit e18f2ce):**
1. `initializeYDoc`: Added Y.Array("wiring") population from ECSON wiring array
2. `syncToYDoc`: Added `syncWiring()` helper called during full-sync mode
3. `yDocToEcson`: Reads from Y.Array("wiring") instead of hardcoding `[]`
4. `persistence.ts:syncEcsonToProject`: Reads Y.Array("wiring") and Y.Map("metadata")
5. `observeRemoteChanges`: Observes Y.Array("wiring") with proper event typing
6. `provider.tsx`: Includes Y.Array("wiring") in UndoManager tracked scopes

**Test coverage:**
- `preserves wiring through Y.Doc round-trip (P5-001)` — verifies all wire fields survive init→reconstruct
- `syncs wiring changes in full-sync mode` — verifies wiring additions propagate
- `triggers callback on remote wiring changes` — verifies remote wiring changes trigger rebuild

### P5-002 (S1): Environment edits not synced — FIXED

**Root cause:** `syncToYDoc` routed `__environment__` entityId into the entity map lookup instead of the environment Y.Map.

**Fix (commit e18f2ce):**
- Added `entityId === "__environment__"` check as the first branch in `syncToYDoc`, before entity lookup. When matched, syncs `ecsonDoc.environment` properties to the `yEnvironment` Y.Map with JSON diff comparison.

**Test coverage:**
- `syncs environment via __environment__ entityId (P5-002)` — modifies `ambientLight.intensity` via `__environment__`, verifies round-trip

### P5-003 (S1): Unvalidated Y.Doc → ECSON cast — FIXED

**Root cause:** `yDocToEcson` used `as unknown as SceneDocument` cast without validation.

**Fix (commit e18f2ce):**
- Imported `SceneDocumentSchema` from `@riff3d/ecson`
- Runs `SceneDocumentSchema.safeParse(raw)` on reconstructed document
- On success: returns validated data (Zod defaults fill any missing fields)
- On failure: logs validation error for diagnostics, returns best-effort cast (fail-open to avoid crashing the editor, but logs the issue)

**Test coverage:**
- `result passes schema validation (P5-003)` — verifies round-trip output passes Zod parse
- `handles empty Y.Doc gracefully (returns fallback)` — verifies empty doc doesn't throw

### P5-004 (S1): No collaboration tests — FIXED

**Fix (commit e18f2ce):**
- Created `apps/editor/__tests__/collaboration.test.ts` with 29 tests across 4 describe blocks:
  1. **Sync Bridge** (17 tests): initializeYDoc + yDocToEcson round-trip, syncToYDoc entity/environment/wiring/asset changes, observeRemoteChanges with remote/local/init origins
  2. **Schema Validation** (2 tests): Well-formed validation, empty Y.Doc graceful handling
  3. **Undo Isolation** (2 tests): Y.UndoManager only undoes local-origin changes, redo correctness
  4. **Lock Manager** (8 tests): Acquisition, conflict blocking, hierarchical propagation, ancestor blocking, release, releaseAll, getLockedEntities, independent entity locking

All tests use headless Y.Docs (no Hocuspocus server needed) for deterministic CI execution.

### P5-005 (S2): Lint errors in collaboration paths — FIXED

**Fix (commit e18f2ce):**
- `use-awareness.ts`: Replaced `remoteUsersRef.current` in return with `useState` for render-safe access; updated `useCallback` deps from `collab?.awareness` to `collab` (React Compiler compatibility)
- `use-entity-locks.ts`: Moved `awarenessRef.current = awareness` assignment into `useEffect` body
- `use-remote-changes.ts`: Captured `timersRef.current` to local variable before cleanup closure
- `provider.tsx`: Added `useState<CollabContextValue>` for context value instead of reading refs in render; `setContextValue` called in `onSynced` callback and cleanup
- `editor-shell.tsx`: Replaced `useEffect` + `setState` with `useMemo` for synchronous project initialization; removed unused `hasLoadedProject` ref and `useEffect` import

**Result:** 0 lint errors (down from 12), 2 pre-existing warnings (unused vars in test file and catch handler)

## Updated Evidence

| Metric | Before | After |
|--------|--------|-------|
| Tests | 690 | **719** |
| Test failures | 0 | **0** |
| Lint errors | 12 | **0** |
| Lint warnings | 3 | **2** |
| Collaboration tests | 0 | **29** |

## Re-review Readiness

All 5 findings addressed. Ready for Codex final-review.
